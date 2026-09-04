/// <reference lib="webworker" />
type PyodideLike = { runPython(code: string): unknown }
declare const loadPyodide: (o: { indexURL: string }) => Promise<PyodideLike>

// Worker CLASSIQUE, volontairement pas `type: 'module'`.
// importScripts est une simple requête HTTP : Vite sert le fichier depuis public/.
// Un import() de module, lui, déclenche la garde « this file is in /public and
// should not be imported from source code » et échoue en développement.
importScripts('/pyodide/pyodide.js')

/**
 * Harnais Python. Il capture stdout, simule input() à partir d'une liste fournie,
 * attrape SyntaxError séparément (elle n'a pas de traceback exploitable) et
 * sérialise les variables demandées. Il ne juge jamais la réponse.
 *
 * stdout est à la fois RETENU, pour la comparaison finale, et DIFFUSÉ au fil de
 * l'eau vers le fil principal. La diffusion sert deux cas que la capture seule
 * ne couvrait pas : voir son programme écrire pendant qu'il tourne, et voir ce
 * qu'une boucle infinie a affiché avant d'être coupée — auparavant l'élève
 * n'obtenait rien du tout dans ce cas.
 */
const HARNAIS = `
import sys, io, json, js

# Au-dela, on cesse de retenir et de diffuser. Une boucle qui affiche sans fin
# produit des megaoctets en cinq secondes : sans plafond, l'onglet gonfle
# jusqu'a devenir inutilisable avant meme que le minuteur ne coupe.
_QG_PLAFOND = 60000


class _QgSortie(io.StringIO):
    def __init__(self, identifiant):
        super().__init__()
        self._identifiant = identifiant
        self._ecrits = 0

    def write(self, texte):
        if self._ecrits >= _QG_PLAFOND:
            return len(texte)
        morceau = texte[: _QG_PLAFOND - self._ecrits]
        self._ecrits += len(morceau)
        js.postMessage(js.Object.fromEntries([["id", self._identifiant], ["flux", morceau]]))
        return super().write(morceau)


def _qg_executer(code, entrees, noms, identifiant):
    sortie = _QgSortie(identifiant)
    restantes = list(entrees)

    def _input(invite=""):
        sortie.write(str(invite))
        if not restantes:
            raise EOFError("Ton programme demande plus de reponses que prevu.")
        valeur = restantes.pop(0)
        sortie.write(valeur + "\\n")
        return valeur

    espace = {"__name__": "__main__", "input": _input}
    ancien, sys.stdout = sys.stdout, sortie
    erreur = None
    try:
        exec(compile(code, "<programme>", "exec"), espace)
    except SyntaxError as e:
        erreur = {"type": type(e).__name__, "message": str(e.msg), "ligne": e.lineno}
    except BaseException as e:
        tb, ligne = e.__traceback__, None
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == "<programme>":
                ligne = tb.tb_lineno
            tb = tb.tb_next
        erreur = {"type": type(e).__name__, "message": str(e), "ligne": ligne}
    finally:
        sys.stdout = ancien

    variables = {}
    for nom in noms:
        if nom in espace:
            v = espace[nom]
            variables[nom] = {"valeur": repr(v), "type": type(v).__name__}

    return json.dumps({"stdout": sortie.getvalue(), "erreur": erreur, "variables": variables})
`

let pyodide: PyodideLike | null = null

async function demarrer(): Promise<PyodideLike> {
  if (!pyodide) {
    const instance = await loadPyodide({ indexURL: '/pyodide/' })
    instance.runPython(HARNAIS)
    pyodide = instance
  }
  return pyodide
}

self.onmessage = async (evenement: MessageEvent) => {
  const { id, code, entrees, nomsVariables } = evenement.data
  try {
    const py = await demarrer()
    const appel = py.runPython(
      `_qg_executer(${JSON.stringify(code)}, ${JSON.stringify(entrees)}, ${JSON.stringify(nomsVariables)}, ${JSON.stringify(id)})`,
    ) as string
    self.postMessage({ id, ok: true, charge: JSON.parse(appel) })
  } catch (e) {
    self.postMessage({ id, ok: false, message: String(e) })
  }
}

self.postMessage({ id: 'pret' })

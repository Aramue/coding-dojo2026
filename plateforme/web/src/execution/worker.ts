/// <reference lib="webworker" />
type PyodideLike = { runPython(code: string): unknown }

/**
 * Harnais Python. Il capture stdout, simule input() à partir d'une liste fournie,
 * attrape SyntaxError séparément (elle n'a pas de traceback exploitable) et
 * sérialise les variables demandées. Il ne juge jamais la réponse.
 */
const HARNAIS = `
import sys, io, json

def _qg_executer(code, entrees, noms):
    sortie = io.StringIO()
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
    // Le worker est de type module : `importScripts` n'y existe pas.
    // On charge la variante ESM depuis public/, au runtime, sans que Vite la bundle.
    // On passe par une variable (plutôt qu'un littéral inline) pour que
    // l'analyse d'import de Vite ne tente pas de résoudre à la compilation
    // ce fichier de public/ (« Cannot import non-asset file ... inside /public »),
    // et pour que tsc ne tente pas non plus de résoudre ce chemin, résolu
    // uniquement au runtime par le navigateur.
    const chemin = '/pyodide/pyodide.mjs'
    const module = await import(/* @vite-ignore */ chemin)
    const instance = (await module.loadPyodide({ indexURL: '/pyodide/' })) as PyodideLike
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
      `_qg_executer(${JSON.stringify(code)}, ${JSON.stringify(entrees)}, ${JSON.stringify(nomsVariables)})`,
    ) as string
    self.postMessage({ id, ok: true, charge: JSON.parse(appel) })
  } catch (e) {
    self.postMessage({ id, ok: false, message: String(e) })
  }
}

self.postMessage({ id: 'pret' })

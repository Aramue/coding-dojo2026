import type { ErreurPython } from '../execution/types'

export type MessageErreur = {
  titre: string
  explication: string
  /** Ce qu'il faut essayer. Ne contient JAMAIS la ligne corrigée. */
  piste: string
}

type Regle = {
  type: string
  motif: RegExp
  construire: (c: RegExpMatchArray) => MessageErreur
}

const REGLES: Regle[] = [
  {
    type: 'NameError',
    motif: /name '(.+?)' is not defined/,
    construire: (c) => ({
      titre: `La variable ${c[1]} n'existe pas encore`,
      explication: `Tu utilises ${c[1]} avant de lui avoir donné une valeur.`,
      piste: `Vérifie que tu l'as bien créée plus haut, et que tu l'écris exactement pareil — Python distingue les majuscules des minuscules. Attention à l'orthographe, écris-la différemment.`,
    }),
  },
  {
    type: 'TypeError',
    motif: /can only concatenate str \(not "(\w+)"\) to str/,
    construire: () => ({
      titre: 'Tu essaies de coller un nombre à du texte',
      explication: `Python refuse d'additionner du texte et un nombre : ce sont deux types différents.`,
      // Pas de mention du f-string : cette erreur est rencontree en s1-21, alors
      // que le f-string n'est enseigne qu'en s1-23. Suggerer une technique pas
      // encore vue, et que l'exercice refuse, envoie l'eleve dans le mur.
      piste: `Transforme le nombre en texte avant de le coller : str(age).`,
    }),
  },
  {
    type: 'TypeError',
    motif: /unsupported operand type\(s\) for (.+?): '(\w+)' and '(\w+)'/,
    construire: (c) => ({
      titre: `Impossible de faire ${c[1]} entre ${c[2]} et ${c[3]}`,
      explication: `Ces deux valeurs ne sont pas du même type, Python ne sait pas les combiner.`,
      piste: `Regarde d'où vient chaque valeur. Une réponse de input() est toujours du texte, même si elle ressemble à un nombre.`,
    }),
  },
  {
    type: 'ValueError',
    motif: /invalid literal for int\(\) with base 10: '(.*)'/,
    construire: (c) => ({
      titre: `int() n'arrive pas à convertir « ${c[1]} »`,
      explication: `int() attend uniquement des chiffres, pas des lettres.`,
      piste: `Vérifie ce que tu donnes à int(). Si la valeur vient de input(), l'élève doit taper un nombre.`,
    }),
  },
  {
    type: 'SyntaxError',
    motif: /expected ':'/,
    construire: () => ({
      titre: 'Il manque un deux-points',
      explication: `En Python, if, elif, else, for et while finissent toujours par « : ».`,
      piste: `Ajoute « : » à la fin de la ligne signalée.`,
    }),
  },
  {
    type: 'SyntaxError',
    motif: /unterminated string literal|EOL while scanning string literal/,
    construire: () => ({
      titre: 'Un guillemet n\'est pas fermé',
      explication: `Un texte s'ouvre et se ferme avec le même guillemet.`,
      piste: `Compte les guillemets de la ligne signalée : il en faut un nombre pair.`,
    }),
  },
  {
    type: 'IndentationError',
    motif: /.*/,
    construire: () => ({
      titre: 'Cette ligne n\'est pas alignée avec les autres',
      explication: `Tout ce qui est à l'intérieur d'un if, d'un for ou d'un while doit être décalé de la même façon.`,
      piste: `Utilise toujours 4 espaces, et le même décalage pour toutes les lignes d'un même bloc.`,
    }),
  },
  {
    type: 'ZeroDivisionError',
    motif: /.*/,
    construire: () => ({
      titre: 'Division par zéro',
      explication: `Diviser par zéro n'a pas de résultat, Python s'arrête.`,
      piste: `Vérifie la valeur de ton diviseur juste avant la division.`,
    }),
  },
  {
    type: 'IndexError',
    motif: /.*/,
    construire: () => ({
      titre: 'Tu demandes une position qui n\'existe pas',
      explication: `Le premier caractère est à la position 0, pas 1. Le dernier est à la longueur moins 1.`,
      piste: `Affiche la longueur avec len() pour voir jusqu'où tu peux aller.`,
    }),
  },
  {
    type: 'AttributeError',
    motif: /'(\w+)' object has no attribute '(\w+)'/,
    construire: (c) => ({
      titre: `Un ${c[1]} ne sait pas faire ${c[2]}`,
      explication: `Cette opération n'existe pas pour ce type de valeur.`,
      piste: `Vérifie le type de ta variable : un nombre et un texte ne savent pas faire les mêmes choses.`,
    }),
  },
]

const GENERIQUE: MessageErreur = {
  titre: 'Ton programme s\'est arrêté sur une erreur',
  explication: `Python n'a pas réussi à exécuter ton code jusqu'au bout.`,
  piste: `Relis la ligne signalée. Si tu ne vois pas, demande un indice.`,
}

/** Le message obtenu par un élève doit toujours être en français, sans jargon. */
export function traduireErreur(erreur: ErreurPython): MessageErreur {
  if (erreur.type === 'TimeoutError') {
    return {
      titre: 'Ton programme tourne en rond',
      explication: `Il s'exécute depuis plus de 5 secondes sans s'arrêter.`,
      piste: `Vérifie que ta condition de while finit par devenir fausse, et que la variable testée change bien à chaque tour.`,
    }
  }
  for (const regle of REGLES) {
    if (regle.type !== erreur.type) continue
    const capture = erreur.message.match(regle.motif)
    if (capture) return regle.construire(capture)
  }
  return GENERIQUE
}

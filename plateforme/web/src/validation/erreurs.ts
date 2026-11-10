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

/** Le nom qu'un débutant comprend, pour les types qu'il a appris. */
const NOMS_DE_TYPE: Record<string, string> = {
  int: 'un nombre entier',
  float: 'un nombre à virgule',
  bool: 'un booléen',
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
    type: 'TypeError',
    // Rencontrée exprès en s3-14 : for sur un nombre. Sans cette règle, le
    // message générique ne disait pas ce qu'on ne peut pas parcourir.
    motif: /'(\w+)' object is not iterable/,
    construire: (c) => ({
      titre: `On ne parcourt pas ${NOMS_DE_TYPE[c[1]!] ?? `une valeur de type ${c[1]}`}`,
      explication: `for parcourt un texte caractère par caractère, ou les valeurs d'un range(). Cette valeur n'a rien à parcourir.`,
      piste: `Pour parcourir les chiffres d'un nombre, transforme-le d'abord en texte avec str().`,
    }),
  },
  {
    type: 'ValueError',
    motif: /invalid literal for int\(\) with base 10: '(.*)'/,
    construire: (c) => ({
      titre: `int() n'arrive pas à convertir « ${c[1]} »`,
      explication: `int() attend uniquement des chiffres, pas des lettres.`,
      piste: `Vérifie ce que tu donnes à int(). Si la valeur vient de input(), il faut taper un nombre, pas des lettres.`,
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
    // Python le devine depuis la version 3.10, mais le dit en anglais. Sans
    // cette règle, l'erreur la plus fréquente du débutant qui compare tombait
    // sur le message générique, qui ne dit rien.
    motif: /Maybe you meant '==' or ':=' instead of '='/,
    construire: () => ({
      titre: 'Un seul = là où Python attend une comparaison',
      explication: `Le signe = range une valeur dans une variable. Il ne demande pas si deux valeurs sont égales.`,
      piste: `Regarde le = de la ligne signalée : range-t-il une valeur, ou pose-t-il une question ? Pour comparer, le signe s'écrit ==.`,
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
    type: 'KeyError',
    // Python rend la cle telle qu'elle est ecrite : 'prenom' avec ses
    // apostrophes, ou 3 pour une cle numerique. On l'affiche sans les modifier.
    motif: /^(.+)$/s,
    construire: (c) => ({
      titre: `La clé ${c[1]} n'existe pas dans ce dictionnaire`,
      explication: `Un dictionnaire ne connaît que les clés qu'on y a écrites, exactement comme on les a écrites : les majuscules et les accents comptent.`,
      piste: `Affiche le dictionnaire avec print() pour voir ses clés, puis compare avec celle que tu demandes.`,
    }),
  },
  {
    type: 'TypeError',
    // La leçon « Envoyer une requête » : reponse est l'objet complet renvoyé par
    // le service, pas ses données. La piste renvoie à la leçon sans écrire la
    // ligne corrigée.
    motif: /'Response' object is not subscriptable/,
    construire: () => ({
      titre: 'Une réponse ne se lit pas comme un dictionnaire',
      explication: `La variable contient la réponse complète du service : son code de statut, ses en-têtes, son texte. Les données, elles, sont à l'intérieur.`,
      piste: `Relis dans la leçon comment extraire les données d'une réponse, puis lis-les comme un dictionnaire.`,
    }),
  },
  {
    type: 'JSONDecodeError',
    motif: /.*/s,
    construire: () => ({
      titre: `Ce texte n'est pas du JSON valide`,
      explication: `json.loads() attend du JSON : les clés et les textes entre guillemets doubles, une virgule entre deux éléments, et aucune virgule en trop à la fin.`,
      piste: `Compare ton texte à l'exemple de la leçon. Une apostrophe à la place d'un guillemet double suffit à le rendre invalide.`,
    }),
  },
  {
    type: 'ConnectionError',
    motif: /.*/s,
    construire: () => ({
      titre: 'Le service ne répond pas',
      explication: `Ton programme a envoyé sa requête, mais aucune réponse n'est revenue.`,
      piste: `Attends quelques secondes et réessaie. Si ça ne change rien, appelle le professeur : c'est peut-être le réseau de la salle.`,
    }),
  },
  {
    type: 'Timeout',
    motif: /.*/s,
    construire: () => ({
      titre: 'Le service met trop de temps à répondre',
      explication: `Les requêtes de ton programme ont pris plus de temps que prévu.`,
      piste: `Réessaie. Si tu envoies plusieurs requêtes, vérifie que tu n'en demandes pas plus qu'il n'en faut.`,
    }),
  },
  {
    type: 'HTTPError',
    motif: /.*/s,
    construire: (c) => ({
      titre: 'Le service a répondu par une erreur',
      explication: c[0],
      piste: `Affiche le code de statut de la réponse, puis son texte : le service dit lui-même ce qui ne va pas dans ta requête.`,
    }),
  },
  {
    type: 'RequestException',
    // Le message vient du requests du dojo, déjà écrit en français : adresse
    // refusée, trop de requêtes, méthode non proposée.
    motif: /.*/s,
    construire: (c) => ({
      titre: 'Ta requête ne peut pas partir',
      explication: c[0],
      piste: `Relis l'adresse et les paramètres de ta requête.`,
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

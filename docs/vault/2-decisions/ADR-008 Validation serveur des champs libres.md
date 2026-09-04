---
title: ADR-008 Validation serveur des champs libres
tags:
  - decision
  - securite
statut: acceptée
date: 2026-09-03
---

# ADR-008 — Validation serveur des champs libres

> [!success] Statut : acceptée le 3 septembre 2026, après trois rondes de correction

## Contexte

La contrainte n°1 du projet est que ==le code écrit par l'élève ne quitte jamais son navigateur==
([[ADR-001 Exécution du code dans le navigateur]]). Elle porte tout le dossier de sécurité UNIGE.

Trois fuites successives ont été trouvées, chacune en conditions réelles, chacune fermant un
vecteur sans fermer la classe.

**Fuite 1.** L'application envoyait `resultat.titre` dans le champ `type_erreur`. Or les messages
de verdict sont construits à partir des captures Python : *« La variable **nom_choisi_par_l_eleve**
n'existe pas encore »*. Corrigé en envoyant le nom de l'exception à la place.

**Fuite 2.** `type(e).__name__` n'est une catégorie technique que pour les exceptions du langage.
Un élève écrit :

```python
class MotDePasseSecretDeQuentin(Exception): pass
raise MotDePasseSecretDeQuentin()
```

et le texte de son choix est persisté en base. Corrigé par une liste blanche côté navigateur.

**Fuite 3 — la seule qui comptait vraiment.** Cette liste blanche vit dans le JavaScript du
navigateur de l'élève, ==donc sur sa machine, sous son contrôle==. Il ouvre la console, récupère
son propre jeton via `POST /session` — qui le renvoie en clair, c'est normal — et poste
directement vers `/tentative` :

```
type_erreur = 'BYPASS_DIRECT_API_texte_libre_de_eleve_1234567890'   → HTTP 200, persisté
exercice_id = 'texte_libre_dans_exercice_id_32c'                    → HTTP 200, persisté
```

`verdict` et `duree_ms` ont résisté : l'un est une énumération Pydantic, l'autre un entier borné.
Les deux champs `str` n'avaient qu'une longueur maximale.

## Décision

**Tout champ texte accepté par l'API est validé côté serveur par motif ou par liste blanche.**

| Champ | Validation |
|---|---|
| `code_agent` | motif `^AGENT-[A-Z0-9]{4}$` — devenu `code_acces` / `^DOJO-…$`, voir [[ADR-010 Abandon de la fiction narrative]] |
| `exercice_id` | motif `^s[123]-[0-9]{2}(-expert)?$` |
| `type_erreur` | liste blanche de 21 valeurs, dont `AutreErreur` |
| `verdict` | `Literal["vert", "bleu", "rouge"]` |
| `duree_ms` | entier borné 0 à 600 000 |
| `concept` (prof) | liste blanche des cinq familles |

Tout corps de requête porte `extra="forbid"` : un champ non déclaré est refusé en 422.

La liste blanche des exceptions est **volontairement dupliquée** entre
`web/src/execution/exceptions.ts` et `api/app/routes_eleve.py`. Le doublon est assumé et commenté
aux deux endroits.

> [!danger] La règle à retenir
> ==Une défense qui n'existe que côté client n'est pas une défense, dès lors que le client est la
> machine de l'utilisateur.== Le filtre du navigateur reste utile — il évite un aller-retour
> inutile et garde l'interface cohérente — mais **ce n'est pas lui qui protège**.

## Conséquences

- Un élève ne peut plus faire persister aucun texte de son choix, même en contournant
  entièrement le JavaScript de l'application.
- Ajouter un exercice hors du motif `s1-01` demande d'élargir `MOTIF_EXERCICE` des deux côtés.
- Ajouter une exception au catalogue demande d'éditer **les deux** listes. Un test le rappelle.
- Le tableau de bord ne peut afficher qu'une catégorie d'erreur, jamais un message. C'est
  suffisant : le professeur a besoin de savoir *quel type* d'erreur bloque, pas du détail.

## Ce que ça a coûté

Trois rondes de correction sur la tâche 11, plus une correction préventive sur la tâche 12 — un
relecteur avait lu le brief de la tâche suivante et y avait repéré la même erreur de conception en
gestation (`concept` sans contrainte, code professeur par défaut devinable).

> [!tip] La question qui a fait la différence
> Les deux premières rondes répondaient à « le vecteur est-il fermé ? ». La troisième est venue
> d'une consigne différente donnée au relecteur : ==« essaie de faire sortir du texte, par
> n'importe quel moyen »==. Un relecteur trouve ce qu'on lui désigne.

## Voir aussi

[[ADR-002 Identification par code d'agent]] · [[Vue d'ensemble]] · [[Pièges et invariants]]

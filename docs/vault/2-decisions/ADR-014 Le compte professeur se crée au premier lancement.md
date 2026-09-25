---
title: ADR-014 Le compte professeur se crée au premier lancement
tags:
  - decision
  - deploiement
  - professeur
statut: acceptée
date: 2026-09-25
---

# ADR-014 — Le compte professeur se crée au premier lancement

> [!success] Statut : acceptée le 25 septembre 2026

## Contexte

Jusqu'ici, deux secrets devaient être écrits à la main dans le `.env` avant tout démarrage :
`DOJO_SECRET`, qui signe les jetons des élèves, et `DOJO_CODE_PROF`, qui ouvre le tableau de
bord. `docker compose` refusait de démarrer sans eux.

À l'usage, ce fichier a coûté plus qu'il ne protégeait :

- **Le code professeur était introuvable** pour qui ne savait pas où chercher. L'écran de `/prof`
  renvoyait vers « la valeur de `DOJO_CODE_PROF` dans le fichier `.env` du serveur », c'est-à-dire
  vers un terminal. Le 24 septembre, la question posée était littéralement « c'est quoi le code
  professeur ».
- **Sans `.env`, l'API tirait des valeurs au hasard** à chaque démarrage. Sans danger, mais le
  code affiché dans le terminal changeait à chaque lancement, et les codes donnés la veille
  étaient morts le lendemain.
- **Le code voyageait en clair** dans chaque requête, et restait dans le `sessionStorage` de
  l'onglet tant qu'il était ouvert.

## Décision

**L'instance tire elle-même ses secrets, et le professeur crée son compte depuis l'application.
Le `.env` ne porte plus aucun secret.**

- **Premier lancement.** Tant qu'aucun compte n'existe, `/prof` affiche « Créer le compte
  professeur » : un mot de passe, sa confirmation, 12 caractères au minimum. Ensuite, la porte
  demande ce mot de passe.
- **Un seul compte, sans identifiant.** Il n'y a qu'un professeur par instance : un champ
  « identifiant » serait un champ de plus à retenir, pour rien.
- **Premier arrivé.** La création est ouverte à quiconque ouvre `/prof` tant qu'aucun compte
  n'existe, sans limite de temps. ==Le compte se crée juste après chaque nouveau déploiement.==
- **Le mot de passe est haché** avec scrypt, que Python fournit lui-même : aucune dépendance
  ajoutée. Personne ne peut le relire, pas même depuis la base.
- **La clé des jetons élèves est tirée au premier démarrage** et rangée dans la base, à côté de
  l'empreinte du mot de passe. Elle survit aux redémarrages et part avec la sauvegarde nocturne
  du fichier SQLite.
- **Le mot de passe ne voyage qu'une fois.** La connexion rend un jeton professeur valable
  douze heures, et c'est lui qui accompagne les requêtes du tableau de bord. L'onglet garde le
  jeton, jamais le mot de passe.
- **Mot de passe oublié** : `docker compose exec api python -m app.oublier_prof` efface le compte
  et l'écran de création revient. Les élèves, leurs codes et leur progression ne bougent pas.

## Conséquences

- **Le `.env` ne porte plus que `DOJO_DOMAINE`**, et il est facultatif : sans lui, Caddy sert
  `localhost`. `docker compose up -d --build` fonctionne sur un poste neuf, sans préparation.
- **Changer le mot de passe invalide les jetons ouverts.** Le jeton professeur est signé avec
  l'empreinte du mot de passe : un compte effacé puis recréé ferme toutes les sessions
  professeur ouvertes avec l'ancien.
- **Au passage à ce système, les élèves retapent leur code une fois** : la clé tirée en base
  remplace celle du `.env`, et les jetons signés avec l'ancienne ne valent plus rien. Leur
  progression, elle, est intacte — elle est rattachée au code, pas au jeton.
- **Un jeton expiré ramène à la porte.** Le tableau de bord rafraîchit toutes les dix secondes :
  au premier refus, la session se ferme et le mot de passe est redemandé, au lieu d'un
  « Accès refusé » qui ne dit pas quoi faire.
- **Perdre la base, c'est perdre le compte**, en plus de la progression. Rien de nouveau à
  sauvegarder : c'est le même fichier.

## Le risque accepté

Sur un serveur joignable depuis Internet, **celui qui ouvre `/prof` le premier prend le compte**.
Une fenêtre de trente minutes après le démarrage de l'API a été proposée et écartée : elle ajoute
un redémarrage à faire quand on arrive en retard, pour un risque que l'on ferme soi-même en
créant le compte dans la minute qui suit le déploiement.

Si le compte a été pris par quelqu'un d'autre, `oublier_prof` le rend : il suffit d'un accès au
serveur, que l'intrus n'a pas.

## Alternatives écartées

- **Garder les secrets dans le `.env`.** C'est l'état d'avant, et c'est ce qui a rendu le code
  introuvable.
- **Une fenêtre de création limitée dans le temps**, à la manière de Portainer. Voir ci-dessus.
- **Un code de création affiché dans les journaux du conteneur**, à la manière de Jenkins. Plus
  sûr, mais il faut lire `docker compose logs` avant de pouvoir entrer : on retrouve le terminal
  que la décision cherche à supprimer.
- **Identifiant et mot de passe.** Un seul compte existe par instance.
- **Changer le mot de passe depuis le tableau de bord.** Personne ne l'a demandé ; `oublier_prof`
  suivi d'une nouvelle création couvre le besoin.

## Voir aussi

[[Déploiement UNIGE]] · [[Tableau de bord]] · [[Pièges et invariants]] · [[ADR-012 Le professeur tient la liste de sa classe]] · [[ADR-008 Validation serveur des champs libres]]

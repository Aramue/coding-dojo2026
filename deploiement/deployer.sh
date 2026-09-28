#!/usr/bin/env bash
#
# Deploie un tag sur la VM.
#
#   /var/www/coding-dojo/deploiement/deployer.sh v1.0.0
#
# Ce script ne construit RIEN. Les images viennent de GHCR, ou la CI les a
# construites et testees : la VM a deux coeurs, quatre gigaoctets et un autre
# service en production, et un `pnpm install` chez elle, c'est de la memoire
# prise a ce service. Voir ADR-017.
#
# Jamais pendant une seance : le redemarrage coupe toutes les sonnettes du quiz.
# La partie n'est pas perdue — elle est en base, et les ecrans se rebranchent
# seuls en relisant chaque seconde (ADR-016) — mais la coupure se voit.
set -euo pipefail

TAG="${1:-}"
SANS_DEMANDER="${2:-}"

if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage : $(basename "$0") vX.Y.Z [--sans-demander]" >&2
  echo "        les tags publies : https://github.com/Aramue/coding-dojo2026/tags" >&2
  exit 2
fi

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"
COMPOSE=(docker compose -f docker-compose.yml -f deploiement/production.yml)
DEPOT_IMAGES="ghcr.io/aramue/coding-dojo2026"

etape() { printf '\n==> %s\n' "$1"; }

# Sans `.env`, DOJO_PUBLICATION vaudrait 80 et le conteneur essaierait de
# prendre un port que nginx tient deja. On refuse plutot que d'echouer a moitie.
if [[ ! -f .env ]] || ! grep -q '^DOJO_PUBLICATION=' .env; then
  echo "ECHEC : .env absent ou sans DOJO_PUBLICATION. Voir .env.example." >&2
  exit 2
fi
PUBLICATION="$(grep -E '^DOJO_PUBLICATION=' .env | tail -1 | cut -d= -f2-)"
BASE="http://${PUBLICATION}"

ACTUELLE="$(grep -E '^DOJO_VERSION=' .env | tail -1 | cut -d= -f2- || true)"

if [[ "$SANS_DEMANDER" != "--sans-demander" ]]; then
  echo "Deploiement de ${ACTUELLE:-(rien)} vers $TAG sur $BASE"
  echo "Cela redemarre l'API et coupe toutes les sonnettes du quiz."
  read -r -p "Aucune seance en cours ? [oui/non] " reponse
  if [[ "$reponse" != "oui" ]]; then
    echo "Annule."
    exit 1
  fi
fi

# La sauvegarde d'abord. C'est le seul geste du lot qu'on regretterait de ne pas
# avoir fait, et il ne coute rien.
etape "Sauvegarde de la base"
deploiement/sauvegarde.sh

# Le depot passe sur le tag : le compose, le Caddyfile et les scripts suivent
# les images qu'ils accompagnent.
etape "Depot sur $TAG"
git fetch --tags --prune --quiet
git -c advice.detachedHead=false checkout --quiet "$TAG"

# La version deployee est ecrite noir sur blanc : un humain de passage, six mois
# plus tard, doit pouvoir lire ce qui tourne sans interroger Docker.
etape "Version"
if grep -q '^DOJO_VERSION=' .env; then
  sed -i "s|^DOJO_VERSION=.*|DOJO_VERSION=$TAG|" .env
else
  echo "DOJO_VERSION=$TAG" >> .env
fi
grep -E '^DOJO_(VERSION|PUBLICATION)=' .env

etape "Images"
"${COMPOSE[@]}" pull

# `--no-build` est la garantie : si une image manque, la commande echoue au lieu
# de se mettre a construire sur la VM.
etape "Demarrage"
"${COMPOSE[@]}" up -d --no-build --remove-orphans

etape "Controle de sante"
sain=0
for essai in $(seq 1 30); do
  if curl -fsS --max-time 3 "$BASE/api/sante" 2>/dev/null | grep -q '"etat":"ok"' \
     && curl -fsS --max-time 3 -o /dev/null "$BASE/" 2>/dev/null; then
    echo "    l'API repond et la page est servie, apres ${essai} s"
    sain=1
    break
  fi
  sleep 1
done

if [[ "$sain" != 1 ]]; then
  echo "ECHEC : rien ne repond sur $BASE apres 30 s." >&2
  "${COMPOSE[@]}" ps
  "${COMPOSE[@]}" logs --tail 40
  echo >&2
  echo "Retour arriere : $(basename "$0") ${ACTUELLE:-<tag precedent>} --sans-demander" >&2
  exit 1
fi

# Menage, borne a nos propres images : on garde celle qui tourne et la
# precedente, pour un retour arriere qui ne depende pas du reseau. Les images de
# l'autre service de la machine ne nous regardent pas — aucun `prune` global
# ici, jamais.
etape "Menage"
for service in api web; do
  a_supprimer="$(docker images "$DEPOT_IMAGES/$service" --format '{{.ID}}' | awk 'NR>2' || true)"
  if [[ -n "$a_supprimer" ]]; then
    echo "$a_supprimer" | xargs -r docker rmi --force >/dev/null 2>&1 || true
    echo "    $service : $(echo "$a_supprimer" | wc -l) image(s) ancienne(s) supprimee(s)"
  else
    echo "    $service : rien a supprimer"
  fi
done

etape "$TAG est en ligne"
"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}'
echo
echo "Commit : $(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$DEPOT_IMAGES/api:$TAG" 2>/dev/null || echo inconnu)"
echo "Disque : $(df -h / | awk 'NR==2 {print $4" libres sur "$2" ("$5" utilise)"}')"

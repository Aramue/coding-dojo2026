#!/usr/bin/env bash
#
# Sauvegarde chaude de la base, avec retention.
#
# Tout l'etat de la plateforme tient dans ce seul fichier : la progression des
# eleves, leurs codes d'acces, le compte professeur et la cle qui signe les
# sessions. Restaurer la base restaure les quatre ; la perdre fait perdre les
# quatre. Il n'y a rien d'autre a sauvegarder. Voir ADR-014.
#
# A la main, ou en cron une fois par nuit :
#
#   30 3 * * * /var/www/coding-dojo/deploiement/sauvegarde.sh >> /var/log/coding-dojo-sauvegarde.log 2>&1
#
# 3h30 et pas 3h15 : l'autre service de la machine sauvegarde a 3h15, et deux
# `docker compose exec` en meme temps sur deux coeurs, ce n'est pas la peine.
set -euo pipefail

DESTINATION="${DOJO_SAUVEGARDES:-/var/backups/coding-dojo}"
JOURS="${DOJO_RETENTION:-14}"

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"
COMPOSE=(docker compose -f docker-compose.yml -f deploiement/production.yml)

horodatage() { date -Is; }

# Premier deploiement : il n'y a pas encore de conteneur, donc rien a sauver.
# On sort sans erreur, sinon `deployer.sh` s'arreterait avant de commencer.
if ! "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx api; then
  echo "$(horodatage) api ne tourne pas : rien a sauvegarder"
  exit 0
fi

mkdir -p "$DESTINATION"
temporaire="$(mktemp)"
trap 'rm -f "$temporaire"' EXIT

# `sqlite3.backup` et jamais `cp` : la base est ouverte pendant la copie, et un
# `cp` peut attraper un fichier a moitie ecrit — on ne s'en apercevrait qu'en
# essayant de restaurer. L'image de l'API porte deja Python, donc il n'y a rien
# a installer sur la VM.
"${COMPOSE[@]}" exec -T api python -c '
import gzip, os, sqlite3, sys, tempfile

with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as fichier:
    chemin = fichier.name
source = sqlite3.connect("/app/donnees/dojo.db")
copie = sqlite3.connect(chemin)
with copie:
    source.backup(copie)
copie.close()
source.close()
with open(chemin, "rb") as brut:
    # mtime fixe : sans cela, deux archives du meme contenu differeraient par
    # leur en-tete, et la comparaison ci-dessous ne servirait a rien.
    sys.stdout.buffer.write(gzip.compress(brut.read(), mtime=0))
os.unlink(chemin)
' > "$temporaire"

if [[ ! -s "$temporaire" ]]; then
  echo "$(horodatage) ECHEC : la sauvegarde est vide" >&2
  exit 1
fi

# Rien de neuf, rien a ecrire : sans cette comparaison, une base qui ne bouge
# pas entre deux seances laisserait quatorze copies identiques sur un disque
# partage.
empreinte="$(sha256sum < "$temporaire" | cut -d' ' -f1)"
derniere="$(ls -1t "$DESTINATION"/dojo-*.db.gz 2>/dev/null | head -1 || true)"

if [[ -n "$derniere" && "$(sha256sum < "$derniere" | cut -d' ' -f1)" == "$empreinte" ]]; then
  echo "$(horodatage) base inchangee depuis $(basename "$derniere") : rien a ecrire"
else
  cible="$DESTINATION/dojo-$(date +%Y%m%d-%H%M%S).db.gz"
  cp "$temporaire" "$cible"
  # La base porte les empreintes de mots de passe : personne d'autre ne la lit.
  chmod 600 "$cible"
  echo "$(horodatage) $(basename "$cible") $(du -h "$cible" | cut -f1)"
fi

# La retention est ce qui empeche le dossier de grossir sans fin. Elle passe
# apres l'ecriture : une purge qui tournerait d'abord pourrait tout supprimer
# avant de decouvrir que la nouvelle copie a echoue.
supprimees="$(find "$DESTINATION" -name 'dojo-*.db.gz' -type f -mtime +"$JOURS" -print -delete | wc -l)"
if [[ "$supprimees" -gt 0 ]]; then
  echo "$(horodatage) $supprimees sauvegarde(s) de plus de $JOURS jours supprimee(s)"
fi

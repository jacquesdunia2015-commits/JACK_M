# Serveur de la plateforme de recensement CNBM-RDC (application + API).
# Aucune dépendance à installer : tout est dans Node.js (node:sqlite, node:crypto).
FROM node:22-alpine
WORKDIR /app
# Seul le dossier cnbm/ est copié (le reste du dépôt n'est pas nécessaire).
COPY cnbm ./cnbm
ENV PORT=8080 \
    DONNEES=/donnees \
    NODE_NO_WARNINGS=1
# Base de données et fichiers des membres : à monter sur un disque persistant.
VOLUME /donnees
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://localhost:8080/api/sante || exit 1
CMD ["node", "cnbm/serveur/serveur.mjs"]

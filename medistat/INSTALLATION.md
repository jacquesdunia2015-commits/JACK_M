# Installation de MediStat

Ce document décrit l'installation sur chaque type d'appareil, ainsi que le
déploiement en établissement.

---

## 1. Sur téléphone et tablette

MediStat s'installe comme une application, sans passer par une boutique.

### Android (Chrome, Edge, Samsung Internet, Brave)

1. Ouvrez l'adresse de MediStat dans le navigateur.
2. Menu **⋮** › **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
3. Confirmez.

L'icône apparaît dans la liste des applications. MediStat s'ouvre en plein
écran, sans barre d'adresse.

### iOS et iPadOS (Safari — obligatoire)

1. Ouvrez l'adresse dans **Safari**. Les autres navigateurs iOS ne proposent
   pas l'installation.
2. Bouton **Partager** (carré avec une flèche) › **Sur l'écran d'accueil**.
3. Confirmez.

> Sur iOS, l'espace de stockage attribué à une application web est plus
> restreint et peut être libéré par le système après plusieurs semaines
> d'inutilisation. **Exportez régulièrement vos sauvegardes** si l'iPhone ou
> l'iPad est votre seul support.

### Utilisation hors ligne

Après la première ouverture complète, MediStat fonctionne sans connexion :
consultation des dossiers, saisie, validation, analyses. Les modifications
réalisées hors ligne sont mises en file et transmises au serveur dès le retour
du réseau.

---

## 2. Sur ordinateur

### Méthode A — installateur (recommandée)

Elle installe l'application **et** le serveur local, ce qui permet de travailler
sans dépendre d'un serveur distant.

**Prérequis :** [Node.js 22 ou supérieur](https://nodejs.org).
Le module `node:sqlite` n'existe qu'à partir de cette version.

```bash
# Linux
bash installateurs/installer-linux.sh

# macOS
bash installateurs/installer-macos.command
```

```bat
REM Windows — double-clic, ou depuis une invite de commandes
installateurs\installer-windows.bat
```

L'installateur :

- copie l'application dans un dossier utilisateur (aucun droit administrateur
  n'est requis) ;
- engendre un **secret de signature propre à la machine** ;
- crée un raccourci dans le menu et sur le Bureau ;
- prépare le lanceur, qui démarre le serveur puis ouvre le navigateur.

| Système | Emplacement de l'application | Données |
|---|---|---|
| Linux | `~/.local/share/medistat` | `~/.local/share/medistat/data/` |
| macOS | `~/Library/Application Support/MediStat` | `…/MediStat/data/` |
| Windows | `%LOCALAPPDATA%\MediStat` | `%LOCALAPPDATA%\MediStat\data\` |

### Méthode B — installation depuis le navigateur

Si MediStat est déjà servi quelque part, Chrome, Edge et Brave affichent une
icône **Installer** dans la barre d'adresse. L'application obtient alors sa
propre fenêtre et son entrée dans le menu, sans installer Node.js.

Sur macOS, Safari propose **Partager › Ajouter au Dock**.

### Méthode C — sans rien installer

```bash
node server/api.mjs
```

Puis ouvrez `http://localhost:8080`.

Sans Node.js, n'importe quel serveur statique convient :

```bash
python3 -m http.server 8080
```

L'application fonctionne alors intégralement dans le navigateur, sans API.

> **L'ouverture directe de `index.html` (`file://`) ne fonctionne pas.**
> Les modules JavaScript et l'API WebCrypto exigent une origine `https://` ou
> `http://localhost`. C'est une contrainte des navigateurs.

---

## 3. Déploiement en établissement

### Serveur unique, postes clients

```bash
export MEDISTAT_SECRET="$(openssl rand -base64 32)"
export MEDISTAT_PORT=8080
node server/api.mjs --db /var/lib/medistat/medistat.db
```

Conservez `MEDISTAT_SECRET` : sans lui, toutes les sessions sont invalidées à
chaque redémarrage.

### Service systemd

```ini
# /etc/systemd/system/medistat.service
[Unit]
Description=MediStat — serveur d'API
After=network.target

[Service]
Type=simple
User=medistat
WorkingDirectory=/opt/medistat
Environment=MEDISTAT_SECRET=<votre-secret>
Environment=MEDISTAT_DB=/var/lib/medistat/medistat.db
ExecStart=/usr/bin/node /opt/medistat/server/api.mjs --port 8080
Restart=on-failure
RestartSec=5

# Durcissement
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/medistat

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now medistat
```

### Proxy TLS — indispensable

Le chiffrement en transit exigé par l'article 9 est assuré par un proxy.
**WebCrypto n'est d'ailleurs pas disponible sans HTTPS** : sans TLS, le
chiffrement des données au repos ne fonctionnera pas non plus sur les postes
clients.

**Caddy** (certificat automatique) :

```
medistat.exemple.org {
    reverse_proxy localhost:8080
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "same-origin"
    }
}
```

**nginx** :

```nginx
server {
    listen 443 ssl http2;
    server_name medistat.exemple.org;

    ssl_certificate     /etc/letsencrypt/live/medistat.exemple.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/medistat.exemple.org/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

L'en-tête `X-Forwarded-For` est important : sans lui, le journal d'audit
enregistre l'adresse du proxy au lieu de celle du poste.

### Sauvegardes

La base SQLite est un fichier unique. Une sauvegarde cohérente pendant
l'exécution :

```bash
sqlite3 /var/lib/medistat/medistat.db ".backup /sauvegardes/medistat-$(date +%F).db"
```

Ou depuis l'application : *Aide › Maintenance › Sauvegarder maintenant*, qui
produit un JSON complet, journal d'audit inclus.

**Ces fichiers contiennent des données de santé : chiffrez-les et conservez-les
en lieu sûr.**

---

## 4. Mise à jour

1. Sauvegardez.
2. Remplacez les fichiers de l'application (conservez `data/` et `.secret`).
3. Redémarrez le serveur.
4. Sur les postes, un rechargement suffit : le service worker récupère la
   nouvelle version au premier accès en ligne.

Le schéma de la base est créé avec `CREATE TABLE IF NOT EXISTS` : une mise à
jour n'écrase jamais les données existantes.

---

## 5. Vérification de l'installation

```bash
node tests/tous.mjs
```

Les 689 contrôles doivent passer. En cas d'échec, la sortie indique
précisément le contrôle concerné.

```bash
curl http://localhost:8080/api/sante
```

---

## 6. Résolution des problèmes

| Symptôme | Cause | Solution |
|---|---|---|
| Page blanche, erreurs de module en console | Ouverture en `file://` | Utilisez un serveur (voir méthode C) |
| « WebCrypto n'est pas disponible » | Origine non sécurisée | Passez en HTTPS, ou utilisez `localhost` |
| « Les données ne sont PAS conservées » | Navigation privée | Quittez le mode privé, ou exportez avant de fermer |
| `node:sqlite` introuvable | Node.js < 22 | Mettez Node.js à jour |
| Sessions perdues à chaque redémarrage | `MEDISTAT_SECRET` non défini | Définissez-le durablement |
| L'icône « Installer » n'apparaît pas | HTTPS absent, ou déjà installé | Vérifiez le certificat |
| Journal d'audit : « intégrité compromise » | Modification directe de la base | Restaurez depuis une sauvegarde ; investiguez |

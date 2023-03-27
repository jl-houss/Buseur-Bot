# Buseur Bot

### Un bot discord en JS pour automatiser et accélérer le busage

Ce bot permet de rejoindre les places manquantes des competitions que votre cheval a rejoint avec 2 comptes pour accélérer l'obtention des 20 victoires.

## Utilisation

Ajouter 2 comptes au bot en utilisant la commande `/account add` puis utiliser la commande `/busage` pour buser votre cheval.

> Se référer a la catégorie `Les Slash Commandes` pour plus de détails sur l'utilisation des commandes

## Prérequis

- créer un bot dans le portail des developpeurs de discord.
- inviter votre bot dans votre serveur.
- node-js

## Installation

1. Télécharger le bot.
2. Executer la commande `npm i` dans le dossier du bot pour installer les modules requis.
3. Executer la commande `npm i` dans le dossier node_modules/puppeteer pour installer le navigateur requis.
4. Renommer le ficher `.env.example` par `.env`.
5. Remplacer les champs dans le fichier `.env` par les votres comme indiqué dans le fichier.
6. Executer la commande `npm run main` dans le dossier du bot pour le lancer.

## Les Slash Commandes (debute par '\*' = argument requis)

### / account

- **_add_**: pour ajouter un compte, prends les arguements:
  -- **\*username**, le nom d'utilisateur du compte.
  -- **\*password**, le mot de passe du compte.
  -- **\*elevage-id**, l'identifiant de l'elevage a utiliser.

- **_edit_**: pour modifier un compte, prends les arguments:
  -- **\*username**, le nom d'utilisateur du compte a modifier.
  -- **new-username**, le nouveau nom d'utilisateur du compte.
  -- **new-password**, le nouveau mot de passe du compte.
  -- **new-elevage-id**, le nouvel identifiant d'elevage du compte.

- **_delete_**: pour enlever un compte, prends l'argument:
  -- **\*username**, le nom d'utilisateur du compte a supprimer.

- **_list_**: pour lister tous les comptes ajoutés, ne prends aucun argument.

### / busage

pour buser un cheval, prends les arguments:

- **\*horse-id**, l'identifiant du cheval a buser.
- **\*race-type**, le type de competitions a buser.

###### Fait par @jl-houss

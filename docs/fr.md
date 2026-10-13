# Nord Pool

**Connecteur non officiel, sans lien avec Nord Pool.** Il amène dans Gladys
les **prix de l'électricité du lendemain** (day-ahead) du marché Nord Pool :
22 zones de marché de la France à la Finlande, lues depuis le portail public
de [data.nordpoolgroup.com](https://data.nordpoolgroup.com/auction/day-ahead/prices),
sans aucun compte. Nord Pool est une marque de Nord Pool AS.

## Ce que vous obtenez

| Surface                      | Contenu                                                                                                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un appareil par zone         | prix actuel, prix suivant (15 minutes plus tard), moyenne, minimum et maximum du jour, par kWh, dans la devise de votre choix                                                                                                           |
| Déclencheurs de scène        | « début / fin des heures creuses » (les N heures les moins chères de la journée), « changement de niveau de prix » (très bon marché, bon marché, normal, cher, très cher, par rapport à la moyenne du jour), « prix de demain publiés » |
| Widget de tableau de bord    | maintenant, ensuite, moyenne du jour et de demain, courbe de la journée avec l'heure actuelle, niveau de prix et fenêtre la moins chère                                                                                                 |
| Contrats énergétiques (5.2+) | les prix spot de dix zones comme calendriers tarifaires, et un modèle de contrat « Spot Nord Pool » par zone pour le suivi énergétique : prix spot + marge du fournisseur + abonnement mensuel + TVA                                    |

Les prix sont ceux du **marché de gros** (l'enchère du lendemain, fixée à midi
CET pour le jour suivant, par créneaux de 15 minutes depuis octobre 2025).
Votre fournisseur y ajoute sa marge, les frais de réseau et les taxes : les
modèles de contrat vous laissent les renseigner.

## Installation

1. Installez l'intégration depuis le store et ouvrez son écran
   **Configuration**.
2. Choisissez vos **zones de livraison** (la zone de marché de votre
   compteur : FR pour la France, BE, NL, GER pour l'Allemagne et le
   Luxembourg, SE1 à SE4 pour la Suède, NO1 à NO5 pour la Norvège, DK1 et DK2
   pour le Danemark, FI, AT, PL, EE, LT, LV), la **devise** des capteurs et le
   nombre d'**heures creuses par jour** (4 par défaut). Enregistrez.
3. Ouvrez **Découverte** et créez l'appareil de chaque zone.
4. Placez le widget **Prix de l'électricité** sur un tableau de bord et
   choisissez la zone.

Rien d'autre : ni clé, ni compte. L'intégration lit Nord Pool au démarrage
puis toutes les heures, demande demain à partir de 12 h 45 CET toutes les 10
minutes jusqu'à publication, et fait avancer les capteurs toutes les 15
minutes.

## Scènes

- **Début / fin des heures creuses** : se déclenche quand le créneau actuel
  entre dans les N heures les moins chères de la journée ou en sort (N =
  « heures creuses par jour »). Lancez le chauffe-eau, la recharge, la
  machine à laver.
- **Changement de niveau de prix** : se déclenche à chaque changement de
  niveau, avec le nouveau et l'ancien ; filtrez sur un niveau pour ne réagir
  qu'au « très cher ».
- **Prix de demain publiés** : se déclenche une fois par jour, vers 13 h CET,
  avec la moyenne, le minimum, le maximum et la fenêtre la moins chère de
  demain (début et fin), prêts pour une notification.

Chaque événement porte le prix, la devise et la fin du créneau.

## Contrats énergétiques (Gladys 5.2 ou plus récent)

Pour FR, BE, NL, GER, AT, FI, DK1, DK2, SE3 et NO1, l'intégration alimente un
calendrier tarifaire (`spot-fr`, `spot-de-lu`, `spot-se3`…) avec les prix spot
par 15 minutes, dans la devise de la zone, et remplit les six dernières
semaines la première fois. Dans **Suivi énergétique → Contrats**, créez un
contrat depuis le modèle **Spot Nord Pool** de votre zone et renseignez :

- la **marge du fournisseur** par kWh (ajoutez-y les frais de réseau et taxes
  au kWh si vous voulez les compter) ;
- l'**abonnement mensuel** ;
- le taux de **TVA** (prérempli pour le pays) ;
- le **prix de repli**, utilisé pour un créneau qui n'a pas encore de prix
  spot.

Les coûts de votre compteur suivent alors le prix spot créneau par créneau, et
le widget « prix actuel » et le déclencheur de scène du cœur fonctionnent avec.
Les douze autres zones n'ont pas encore de calendrier (le store en autorise dix
par intégration) : dites-le sur le forum si vous avez besoin de la vôtre.

## Options

- **Zones de livraison** : un appareil chacune ; les capteurs partagent la
  devise choisie.
- **Devise des capteurs** : EUR, SEK, NOK, DKK ou PLN, convertie par Nord Pool
  à son taux du jour. Les calendriers utilisent toujours la devise de la zone.
- **Heures creuses par jour** : combien des heures les moins chères comptent
  comme « creuses » pour les déclencheurs et la fenêtre du widget (1 à 12).

Le bouton **Lire les prix maintenant** lit aujourd'hui et demain et affiche
le prix actuel de chaque zone.

## Dépannage

- **« Nord Pool ne publie aucun prix pour … »** : le code de zone n'est pas
  coté par Nord Pool (voir la liste ci-dessus), ou le portail est en panne
  pour la journée.
- **« Nord Pool est injoignable »** : l'intégration garde les derniers prix
  lus et réessaie toutes les 5 minutes.
- **Pas de prix de demain le soir** : Nord Pool les publie entre 12 h 45 et
  14 h CET en temps normal ; lors d'un incident d'enchère ils peuvent venir
  plus tard, l'intégration redemande toutes les 10 minutes.
- **Les coûts du contrat s'arrêtent à une date** : le calendrier est rempli
  six semaines en arrière au plus ; un contrat daté avant est tarifé au prix
  de repli jusque-là.

## Confidentialité

L'intégration ne parle qu'au portail de données Nord Pool, avec une requête
qui ne porte que la date, les zones et la devise. Rien de votre maison ne
quitte Gladys.

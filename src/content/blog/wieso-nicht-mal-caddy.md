---
title: "Wieso probierst du nicht mal Caddy?"
description: "Eine Rückfrage der KI zu Caddy statt Nginx und die Frage dahinter: Wie stark lege ich mit meinem Prompt den Weg fest, und wann sollte ich nur das Ziel beschreiben?"
pubDate: 2026-11-16
tags: ["KI", "Prompting", "Caddy", "Nginx", "Webserver"]
summary: "Wer der KI seinen gewohnten Stack vorgibt, bekommt genau diesen Stack. Das ist oft richtig, weil Erfahrung auch Wissen über den Betrieb ist. Es verbaut aber den Blick auf einfachere Wege. Mein Ansatz: zuerst Ziel und Rahmenbedingungen beschreiben, Festlegungen nur mit Begründung machen und ausdrücklich nach Alternativen fragen."
sources:
  - title: "Caddy Docs: Automatic HTTPS"
    url: "https://caddyserver.com/docs/automatic-https"
  - title: "Caddy Docs: php_fastcgi"
    url: "https://caddyserver.com/docs/caddyfile/directives/php_fastcgi"
---

Für ein privates Projekt wollte ich vor kurzem einen kleinen Server aufsetzen. Eine PHP-Anwendung, nichts Großes. Wie das geht, wusste ich: Nginx, php-fpm, certbot für die Zertifikate. Den Stack nutze ich seit Jahren, die Configs wandern von Server zu Server mit. Genau so habe ich es der KI auch beschrieben.

Sie hat mitgemacht. Server-Block für Nginx, Pool für php-fpm, certbot mit Timer und einem Hook, der Nginx nach der Erneuerung neu lädt. Alles sauber und alles so, wie ich es selbst gemacht hätte.

Ganz am Ende kam dann noch eine Frage: Ob ich nicht mal Caddy probieren möchte. Caddy holt sich die Zertifikate bei Let's Encrypt selbst und erneuert sie auch selbst. Kein certbot, kein Timer, kein Reload-Hook.

Über diese eine Zeile habe ich länger nachgedacht als über den ganzen Server.

## Nginx und Caddy nebeneinander

So sieht das bei mir mit Nginx aus. Ein Server-Block für Port 80, der Let's Encrypt die Challenge ausliefert und alles andere auf HTTPS umleitet, und einer für Port 443 mit TLS und php-fpm:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name meine-domain.de;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name meine-domain.de;

    ssl_certificate     /etc/letsencrypt/live/meine-domain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/meine-domain.de/privkey.pem;

    root /var/www/app/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }
}
```

Damit ist es aber noch nicht getan. Das Zertifikat muss erst einmal da sein, und Nginx muss nach jeder Erneuerung neu laden:

```bash
mkdir -p /var/www/certbot
certbot certonly --webroot -w /var/www/certbot -d meine-domain.de

# Nach jeder Erneuerung Nginx neu laden
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'HOOK'
#!/bin/sh
systemctl reload nginx
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# Läuft der Timer für die Erneuerung?
systemctl list-timers certbot.timer
```

Dazu kommt ein Henne-Ei-Problem beim ersten Start: Der Block für Port 443 verweist auf ein Zertifikat, das es noch nicht gibt. Also erst nur Port 80 aktivieren, Zertifikat holen, dann den zweiten Block dazunehmen.

Dasselbe mit Caddy:

```text
meine-domain.de {
    root * /var/www/app/public
    php_fastcgi unix//run/php/php8.3-fpm.sock
    file_server
}
```

Mehr ist es nicht. Zertifikat, Erneuerung, Weiterleitung von HTTP auf HTTPS, HTTP/2 und HTTP/3 sind dabei, ohne dass ich etwas dafür schreiben muss. `php_fastcgi` bringt auch das `try_files` auf `index.php` gleich mit. php-fpm bleibt übrigens, Caddy ersetzt nur den Webserver davor.

## Wer macht was

Am deutlichsten wird der Unterschied, wenn man aufmalt, welche Teile beteiligt sind. Bei Nginx sind es mehrere Werkzeuge, die zusammenspielen müssen:

<figure class="diagram">
<svg viewBox="0 0 480 430" role="img" aria-labelledby="d1-title">
<title id="d1-title">Nginx-Setup: Nginx, php-fpm und die PHP-App, daneben certbot, systemd-Timer, Zertifikatsdateien und Reload-Hook als eigene Teile</title>
<defs><marker id="ah1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head" d="M0 0L10 5L0 10z"/></marker></defs>
<rect class="box" x="20" y="20" width="180" height="48" rx="10"/><text class="t" x="110" y="49">Browser</text>
<rect class="box" x="260" y="20" width="180" height="48" rx="10"/><text class="t" x="350" y="49">Let’s Encrypt</text>
<rect class="box" x="20" y="120" width="180" height="60" rx="10"/><text class="t" x="110" y="145">Nginx</text><text class="s" x="110" y="164">Redirect, TLS, Webserver</text>
<rect class="box own" x="260" y="120" width="180" height="60" rx="10"/><text class="t" x="350" y="145">certbot</text><text class="s" x="350" y="164">ACME-Client</text>
<rect class="box" x="20" y="230" width="180" height="48" rx="10"/><text class="t" x="110" y="259">php-fpm</text>
<rect class="box own" x="260" y="230" width="180" height="48" rx="10"/><text class="t" x="350" y="251">systemd-Timer</text><text class="s" x="350" y="267">zweimal täglich</text>
<rect class="box" x="20" y="330" width="180" height="48" rx="10"/><text class="t" x="110" y="359">PHP-App</text>
<rect class="box own" x="260" y="330" width="180" height="48" rx="10"/><text class="t" x="350" y="351">Zertifikate</text><text class="s" x="350" y="367">/etc/letsencrypt</text>
<path class="arrow" d="M110 68V117" marker-end="url(#ah1)"/><text class="l" x="118" y="98">HTTPS</text>
<path class="arrow" d="M110 180V227" marker-end="url(#ah1)"/><text class="l" x="118" y="208">FastCGI</text>
<path class="arrow" d="M110 278V327" marker-end="url(#ah1)"/>
<path class="arrow" d="M350 71V117" marker-start="url(#ah1)" marker-end="url(#ah1)"/><text class="l" x="358" y="98">ACME</text>
<path class="arrow" d="M350 230V183" marker-end="url(#ah1)"/><text class="l" x="358" y="210">startet</text>
<path class="arrow" d="M440 150H454V354H443" marker-end="url(#ah1)"/><text class="l" x="466" y="252" transform="rotate(90 466 252)">schreibt</text>
<path class="arrow dashed" d="M260 354H230V172H203" marker-end="url(#ah1)"/><text class="l end" x="225" y="304">liest</text>
<path class="arrow own-line" d="M260 140H203" marker-end="url(#ah1)"/><text class="l mid" x="231" y="132">Reload</text>
<rect class="box own" x="20" y="402" width="28" height="16" rx="4"/><text class="l start" x="58" y="414">selbst einrichten und im Blick behalten</text>
</svg>
<figcaption>Nginx: Zertifikate holen, erneuern, ablegen und Nginx neu laden übernehmen eigene Teile.</figcaption>
</figure>

Bei Caddy steckt das alles in einem Prozess:

<figure class="diagram">
<svg viewBox="0 0 480 508" role="img" aria-labelledby="d2-title">
<title id="d2-title">Caddy-Setup: Caddy enthält Redirect, TLS, ACME-Client, Erneuerung, Zertifikatsspeicher und php_fastcgi, dahinter php-fpm und die PHP-App</title>
<defs><marker id="ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head" d="M0 0L10 5L0 10z"/></marker></defs>
<rect class="box" x="20" y="20" width="180" height="48" rx="10"/><text class="t" x="110" y="49">Browser</text>
<rect class="box" x="260" y="20" width="180" height="48" rx="10"/><text class="t" x="350" y="49">Let’s Encrypt</text>
<rect class="frame" x="20" y="120" width="420" height="182" rx="14"/>
<text class="t start" x="40" y="150">Caddy</text><text class="s end" x="420" y="150">ein Prozess, ein Caddyfile</text>
<rect class="chip" x="36" y="170" width="186" height="32" rx="8"/><text class="c" x="129" y="191">HTTP → HTTPS</text>
<rect class="chip" x="238" y="170" width="186" height="32" rx="8"/><text class="c" x="331" y="191">TLS, HTTP/2, HTTP/3</text>
<rect class="chip" x="36" y="212" width="186" height="32" rx="8"/><text class="c" x="129" y="233">ACME-Client</text>
<rect class="chip" x="238" y="212" width="186" height="32" rx="8"/><text class="c" x="331" y="233">automatische Erneuerung</text>
<rect class="chip" x="36" y="254" width="186" height="32" rx="8"/><text class="c" x="129" y="275">Zertifikatsspeicher</text>
<rect class="chip" x="238" y="254" width="186" height="32" rx="8"/><text class="c" x="331" y="275">php_fastcgi</text>
<path class="arrow" d="M110 68V117" marker-end="url(#ah2)"/><text class="l" x="118" y="98">HTTPS</text>
<path class="arrow" d="M350 71V117" marker-start="url(#ah2)" marker-end="url(#ah2)"/><text class="l" x="358" y="98">ACME</text>
<rect class="box" x="20" y="350" width="180" height="48" rx="10"/><text class="t" x="110" y="379">php-fpm</text>
<rect class="box" x="20" y="440" width="180" height="48" rx="10"/><text class="t" x="110" y="469">PHP-App</text>
<path class="arrow" d="M110 302V347" marker-end="url(#ah2)"/><text class="l" x="118" y="330">FastCGI</text>
<path class="arrow" d="M110 398V437" marker-end="url(#ah2)"/>
<text class="s start" x="260" y="374">kein certbot</text>
<text class="s start" x="260" y="394">kein Timer</text>
<text class="s start" x="260" y="414">kein Reload-Hook</text>
</svg>
<figcaption>Caddy: Zertifikate und Erneuerung gehören zum Webserver, es gibt nichts extra einzurichten.</figcaption>
</figure>

Fairerweise: Nginx ist nicht schlechter, und mit certbot läuft das seit Jahren zuverlässig. Inzwischen gibt es für Nginx auch ein offizielles ACME-Modul. Aber es sind eben mehr Teile, die man kennen, einrichten und im Blick behalten muss.

## Ich habe nach dem Weg gefragt, nicht nach dem Ziel

Der eigentliche Punkt ist nicht Caddy. Der Punkt ist, was ich gefragt habe. Ich habe nicht geschrieben: „Ich will eine PHP-Anwendung mit HTTPS ins Netz bringen, möglichst wenig Pflegeaufwand.“ Ich habe geschrieben: „Setz mir Nginx mit php-fpm auf.“ Und genau das habe ich bekommen.

Mit dem Prompt lege ich fest, wie gelöst wird. Die KI nimmt das ernst, und das ist ja auch richtig so. Wenn ich Nginx sage, will ich in der Regel Nginx. Dass sie am Ende trotzdem nachgefragt hat, fand ich gut. Verlassen würde ich mich darauf nicht.

Meine Erfahrung steckt in jedem Prompt, den ich schreibe. Das ist meistens ein Vorteil. Es heißt aber auch, dass ich vor allem Lösungen bekomme, die ich schon kenne.

## Also nur noch das Ziel beschreiben?

Die naheliegende Antwort wäre: Lass die Technik weg, beschreib Ziel und Ausgangslage, die KI sucht sich den besten Weg. So einfach ist es aber nicht.

Erfahrung ist nicht nur Gewohnheit. Sie ist auch Wissen über den Betrieb. Ich weiß, wie sich Nginx unter Last verhält, wo die Logs liegen, wie ich es überwache und was ich nachts um drei mache, wenn es hängt. Bei einem Werkzeug, das ich gestern zum ersten Mal gesehen habe, weiß ich das alles nicht. Und bei Kundenprojekten muss es nicht nur laufen, sondern auch von anderen betrieben werden können.

Wer nur das Ziel beschreibt, bekommt vielleicht die elegantere Lösung. Vielleicht aber auch eine, die niemand im Team betreiben kann.

## Wo ich die Grenze ziehe

Eine feste Regel habe ich nicht. Ein paar Dinge mache ich seitdem aber bewusster:

- **Zuerst Ziel und Umstände.** Was soll laufen, wer betreibt es, wie wichtig ist es, wie viel Zeit will ich in die Pflege stecken. Das gehört an den Anfang, vor jede Technik.
- **Festlegungen mit Begründung.** „Nginx, weil das Team es kennt und das Monitoring darauf aufsetzt“ ist eine Rahmenbedingung, mit der die KI arbeiten kann. „Nginx“ allein ist oft nur Gewohnheit.
- **Ausdrücklich nach Alternativen fragen.** Ein Satz wie „Gibt es einen einfacheren Weg, den ich übersehe?“ kostet nichts. Ob ich ihn dann nehme, entscheide ich immer noch selbst.
- **Privat mehr Freiheit lassen.** Bei einem privaten Projekt darf es ruhig mal etwas Neues sein. Genau da kann man es gefahrlos lernen. Bei Kundenprojekten wiegt Erfahrung schwerer.

Am Ende bleibt die Frage, die mir die KI gestellt hat, und ich gebe sie gern weiter: Wann hast du zuletzt nur das Ziel beschrieben und nicht gleich den Weg?

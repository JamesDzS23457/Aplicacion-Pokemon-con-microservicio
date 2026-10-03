# Datos de las bases de datos

Documento generado automáticamente desde las bases **locales**
(consultadas a través del gateway `http://localhost:3000`) el **2026-10-03**.

Pokémon y docentes guardan como máximo **20 registros** cada una, y el
límite lo impone un *trigger* de PostgreSQL, no el código. One Piece también
tiene 20, pero **su límite no es un trigger**: MongoDB no tiene triggers, así
que se comprueba en el repositorio antes de insertar un documento nuevo (un
id que ya existe sí se puede reescribir, para que el seed sea idempotente).

Las tres bases son de motor distinto: Pokémon y docentes en **PostgreSQL**
(Supabase) y One Piece en **MongoDB** (Atlas).

La tabla de docentes no está llena: contiene las personas autorizadas, que
pueden ser menos de 20, y cambia cuando alguien la edita a mano.

En las dos primeras tablas, si hay retrato, el nombre enlaza a la imagen. En
la de docentes **no**: `foto_url` es opcional y el enlace se rompería en
cuanto ese CDN dejara de servirla.

---

## Personajes de One Piece (20)

| # | id | Nombre | Tripulación | Fruta | Raza | Estado |
|---:|---:|---|---|---|---|---|
| 1 | 1 | [Monkey D Luffy](https://cdn.myanimelist.net/images/characters/9/310307.jpg?s=3a27ab33bee665febfba970f24f203ba) | Piratas del Sombrero de Paja | Fruta Hito Hito, modelo Nika | Humano | Vivo |
| 2 | 2 | [Roronoa Zoro](https://cdn.myanimelist.net/images/characters/3/100534.jpg?s=4a00840eacc26e9ad86bae6f505e4826) | Piratas del Sombrero de Paja | - | Humano | Vivo |
| 3 | 3 | [Nami](https://cdn.myanimelist.net/images/characters/6/59914.jpg?s=302fa4565e9cbd5368b6ca4da51e1a0c) | Piratas del Sombrero de Paja | - | Humano | Vivo |
| 4 | 4 | [Usopp](https://cdn.myanimelist.net/images/characters/16/188076.jpg?s=f24eccad7d76e7747895a9a945d8a3ed) | Piratas del Sombrero de Paja | - | Humano | Vivo |
| 5 | 5 | [Sanji](https://cdn.myanimelist.net/images/characters/5/136769.jpg?s=52b8fdfc38114a389d83dd5301842556) | Piratas del Sombrero de Paja | - | Humano | Vivo |
| 6 | 6 | [Tony-Tony Chopper](https://cdn.myanimelist.net/images/characters/3/100536.jpg?s=9536cd3e6fe65064a110b8d8b2f2808e) | Piratas del Sombrero de Paja | Fruta de la Humanidad | Humano-Reno (fruta Zoan) | Vivo |
| 7 | 7 | [Nico Robin](https://cdn.myanimelist.net/images/characters/16/363700.jpg?s=3e7fa6074c0d30c8bede3905680e983c) | Piratas del Sombrero de Paja | Fruta de la Floración | Humano | Vivo |
| 8 | 8 | [Franky](https://cdn.myanimelist.net/images/characters/13/210053.jpg?s=58f71be3af78384ac43869b8c681efaf) | Piratas del Sombrero de Paja | - | Cyborg (humano modificado) | Vivo |
| 9 | 9 | [Brook](https://cdn.myanimelist.net/images/characters/10/161005.jpg?s=8e3191d4d9691fffe3dafaefaf086014) | Piratas del Sombrero de Paja | Fruta de la Resurrección | Esqueleto (fruta Yomi Yomi) | Vivo |
| 10 | 10 | [Jinbe](https://cdn.myanimelist.net/images/characters/15/307148.jpg?s=20f8bf1d3a9854be84b67367849b1322) | Piratas del Sombrero de Paja | - | Pez-hombre (Fishman) | Vivo |
| 11 | 54 | [Trafalgar D. Water Law](https://cdn.myanimelist.net/images/characters/10/258757.jpg?s=a537201b5cb91a6905765fee2de00012) | Piratas Heart | Fruta del Escalpelo | Humano | Vivo |
| 12 | 70 | [Boa Hancock](https://cdn.myanimelist.net/images/characters/14/146013.jpg?s=cb2628e503ecea60dc2619b4aedf3247) | Piratas Kuja | Fruta de la Pasión | Humano | Vivo |
| 13 | 82 | [Crocodile](https://cdn.myanimelist.net/images/characters/6/100535.jpg?s=3acba3e9944b9f3d1160fff13f6920c3) | - | - | Humano | Vivo |
| 14 | 85 | [Shanks](https://cdn.myanimelist.net/images/characters/9/307639.jpg?s=175776bc9b9338bdc8f64520b1699548) | Piratas del Pelirrojo | - | Humano | Vivo |
| 15 | 96 | [Charlotte Linlin / Big Mom](https://cdn.myanimelist.net/images/characters/14/337166.jpg?s=3b95915f0c2d215e28e9f45a7201250f) | Piratas de Big Mom | Fruta de las Almas | Humano-Gigante | Vivo |
| 16 | 187 | [Kaido](https://cdn.myanimelist.net/images/characters/4/492819.jpg?s=8503e58c06a6c01d16a01621e2002554) | Piratas de las Cien Bestias | Fruta del Pez, modelo Dragón Azul | Humano (fruta Zoan mitica) | Vivo |
| 17 | 258 | [Gol D. Roger](https://cdn.myanimelist.net/images/characters/3/51747.jpg?s=ae111a084d5f0cba17856337c956bc36) | Piratas de Roger | - | Humano | Fallecido |
| 18 | 290 | [Portgas D. Ace](https://cdn.myanimelist.net/images/characters/2/72220.jpg?s=e92b075a899b3b5d3cdac70615d8853b) | Piratas de Barbablanca | Fruta Piro (Fuego) | Humano | Fallecido |
| 19 | 365 | [Don Quijote Doflamingo](https://cdn.myanimelist.net/images/characters/5/349513.jpg?s=d4c15f9b8af8e82e7c05e30b4d1453b8) | Piratas de Donquixote | Fruta del Hilo | Humano | Vivo |
| 20 | 662 | [Sabo](https://cdn.myanimelist.net/images/characters/15/131855.jpg?s=59b1e7a4a656b27d660740ba85e4e93d) | Ejército Revolucionario | Fruta Piro (Fuego) | Humano | Vivo |

Retratos: `cdn.myanimelist.net` (Jikan / MyAnimeList), guardados en
`image_url` durante el seed.

---

## Pokémon (20)

| # | id | Nombre | Tipos | Género | Especie |
|---:|---:|---|---|---|---|
| 1 | 1 | [bulbasaur](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png) | grass, poison | Macho o hembra | Pokémon Semilla |
| 2 | 2 | [ivysaur](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png) | grass, poison | Macho o hembra | Pokémon Semilla |
| 3 | 3 | [venusaur](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/3.png) | grass, poison | Macho o hembra | Pokémon Semilla |
| 4 | 4 | [charmander](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png) | fire | Macho o hembra | Pokémon Lagartija |
| 5 | 5 | [charmeleon](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/5.png) | fire | Macho o hembra | Pokémon Llama |
| 6 | 6 | [charizard](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png) | fire, flying | Macho o hembra | Pokémon Llama |
| 7 | 7 | [squirtle](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png) | water | Macho o hembra | Pokémon Tortuguita |
| 8 | 8 | [wartortle](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/8.png) | water | Macho o hembra | Pokémon Tortuga |
| 9 | 9 | [blastoise](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/9.png) | water | Macho o hembra | Pokémon Armazón |
| 10 | 25 | [pikachu](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png) | electric | Macho o hembra | Pokémon Ratón |
| 11 | 26 | [raichu](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/26.png) | electric | Macho o hembra | Pokémon Ratón |
| 12 | 29 | [nidoran-f](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/29.png) | poison | Siempre hembra | Pokémon Pin Veneno |
| 13 | 30 | [nidorina](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/30.png) | poison | Siempre hembra | Pokémon Pin Veneno |
| 14 | 31 | [nidoqueen](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/31.png) | poison, ground | Siempre hembra | Pokémon Taladro |
| 15 | 35 | [clefairy](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/35.png) | fairy | Macho o hembra | Pokémon Hada |
| 16 | 36 | [clefable](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/36.png) | fairy | Macho o hembra | Pokémon Hada |
| 17 | 37 | [vulpix](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/37.png) | fire | Macho o hembra | Pokémon Zorro |
| 18 | 39 | [jigglypuff](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/39.png) | normal, fairy | Macho o hembra | Pokémon Globo |
| 19 | 94 | [gengar](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png) | ghost, poison | Macho o hembra | Pokémon Sombra |
| 20 | 132 | [ditto](https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/132.png) | - | jhe | jidkw |

Retratos: `raw.githubusercontent.com` (PokeAPI sprites), guardados en
`sprites.front_default` durante el seed.

---

## Docentes (1)

| # | id | Nombre | Cargo | Carrera | Departamento | Foto |
|---:|---:|---|---|---|---|---|
| 01 | 1 | Elfar Didier Morantes Sánchez | Profesional Universitario e Ingeniero de Software | Ingeniería Electrónica | Dirección de Medios y Nuevas Tecnologías | si |

Cada docente tiene **dos textos distintos**, que es lo que exige la quinta
pestaña: `resumen` (el breve, que va en la tarjeta, recortado a tres líneas)
y `biografia` (el completo, que va en la ficha al pulsar «Leer más»).

Esta tabla **no tiene API externa de origen**: se edita a mano en el Table
Editor de Supabase (o con `npm run backend:seed:docentes`, que la reinicia a
partir de `backend/scripts/docentes-datos.js`). Por eso el servicio tiene un
*trigger* que recalcula `search_key`, `carrera_key` y `departamento_key` en cada
inserción: si no, un docente escrito a mano sin esas columnas aparecería en el
listado pero no se encontraría al buscarlo ni se podría filtrar.

`foto_url` es **opcional**. Cuando falta, la app dibuja un avatar con las
iniciales sobre el color de la facultad, así que la pantalla nunca se ve rota.

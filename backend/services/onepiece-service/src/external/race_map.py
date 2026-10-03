# ---------------------------------------------------------------------------
# MAPA DE RAZAS
#
# ESTE DATO NO EXISTE EN LA API DE ONE PIECE.
#
# La API devuelve nombre, talla, edad, recompensa, fruta y tripulacion, pero NO
# tiene ningun campo "raza". Asi que este mapa es dato curado a mano.
#
# El bug que habia antes: las claves se comparaban contra el nombre CRUDO. El
# mapa tenia 'tony tony chopper' (sin guiones) pero la API devuelve
# 'Tony-Tony Chopper' (con guiones), asi que nunca coincidian y el resultado era
# "Humano" con estimated en True. LA CAUSA RAIZ era no normalizar, no el mapa.
# Por eso ahora la clave se busca con normalize_name(): minusculas, sin acentos,
# sin puntuacion y cortando el sufijo "/ Alias".
#
# Si se agregan mas personajes, la clave DEBE escribirse ya normalizada.
# ---------------------------------------------------------------------------

from ..lib.normalize import normalize_name

HUMANO = "Humano"

RACE_MAP = {
    # Tripulacion del Sombrero de Paja
    "monkeydluffy": HUMANO,
    "roronoazoro": HUMANO,
    "nami": HUMANO,
    "usopp": HUMANO,
    "sanji": HUMANO,
    # Chopper es humano con una fruta Zoan que le da forma de reno.
    "tonytonychopper": "Humano-Reno (fruta Zoan)",
    "nicorobin": HUMANO,
    "franky": "Cyborg (humano modificado)",
    # Brook es un esqueleto con una fruta que le permite revivir.
    "brook": "Esqueleto (fruta Yomi Yomi)",
    # Jinbe es un fishman.
    "jinbe": "Pez-hombre (Fishman)",
    # Otros grupos
    "trafalgarwaterlaw": HUMANO,
    "portgasdace": HUMANO,
    "sabo": HUMANO,
    "shanks": HUMANO,
    "boahancock": HUMANO,
    "donquijotedoflamingo": HUMANO,
    # Kaido es humano con una fruta Zoan mitica (antes decia "Pez dragon" mal).
    "kaido": "Humano (fruta Zoan mitica)",
    "charlottelinlin": "Humano-Gigante",
    "charlottelinlinbigmom": "Humano-Gigante",
    "crocodile": HUMANO,
    "goldroger": HUMANO,
    "silversrayleigh": HUMANO,
    "eustasskidd": HUMANO,
    "marshalldteach": HUMANO,
    # Fishmen
    "arlong": "Pez-hombre (Fishman)",
    # Mink
    "inuarashi": "Mink",
    "nekomamushi": "Mink",
    "carrot": "Mink",
    # Familia Kuja
    "reiju": HUMANO,
}


def get_race(name):
    """Devuelve la raza de un personaje como dict.

    Si no esta en el mapa, cae en "Humano" MARCADO COMO ESTIMADO. No se
    devuelve None ni se lanza error, porque casi todos los personajes de One
    Piece son humanos y asi la UI siempre tiene algo que mostrar. El flag
    `estimated` viaja hasta el frontend para distinguir un dato curado de un
    valor por defecto.
    """
    found = RACE_MAP.get(normalize_name(name))
    if found:
        return {"race": found, "estimated": False}
    return {"race": HUMANO, "estimated": True}

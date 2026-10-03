# ---------------------------------------------------------------------------
# TRADUCCION DE LOS DATOS DE ONE PIECE AL ESPANOL
#
# La API externa (api-onepiece.com) mezcla idiomas:
#   - La tripulacion, el oficio y el estado vienen en frances ("vivant") o en
#     ingles ("Captain").
#   - La edad trae el sufijo frances "ans".
#   - El tipo de fruta puede ser "Zoan Mythique".
#
# Este archivo es un mapa CURADO A MANO, igual que race_map.py: la API no
# ofrece traducciones, asi que el texto se traduce UNA vez durante el seed y se
# guarda YA en espanol en la base de datos. Asi la app, la API propia y
# cualquier documento derivado leen el mismo idioma, y no hay que traducir nada
# en tiempo de busqueda.
#
# REGLA: si un valor no esta en el mapa, se devuelve TAL CUAL. Nunca se inventa
# ni se deja vacio: es preferible mostrar un texto sin traducir que perder el
# dato.
#
# Este archivo es la version Python del que tenia el servicio en Node. Los
# valores son los mismos; si se anaden personajes al seed, se agregan aqui sus
# valores nuevos.
# ---------------------------------------------------------------------------

# Tripulaciones. Se usa el nombre canonico en espanol cuando existe y es
# reconocible, en lugar de una traduccion literal que sonaria rara.
CREW_ES = {
    "The Chapeau de Paille crew": "Piratas del Sombrero de Paja",
    # La API escribe "Hearth" (mal): la tripulacion real es la Heart de Law.
    "The Hearth crew": "Piratas Heart",
    "The Kuja Pirates crew": "Piratas Kuja",
    # "Le Roux" es solo un miembro; se usa el nombre canonico de la banda.
    "Le Roux crew": "Piratas del Pelirrojo",
    "Big Mom's crew": "Piratas de Big Mom",
    "The Hundred Beasts crew": "Piratas de las Cien Bestias",
    "The Pirates Roger crew": "Piratas de Roger",
    "Whitebeard's crew": "Piratas de Barbablanca",
    "Don Quixote's crew": "Piratas de Donquixote",
    "Armée Révolutionnaire": "Ejército Revolucionario",
}

# Oficios (cargo a bordo).
JOB_ES = {
    "Captain": "Capitán",
    "Right-hand man": "Mano derecha",
    "Navigator": "Navegante",
    "Sniper": "Francotirador",
    "Cook": "Cocinero",
    "Doctor": "Médico",
    "Archaeologist": "Arqueólogo/a",
    "Carpenter": "Carpintero",
    "Musician": "Músico",
    "Helmsman": "Timonel",
    "Commander 2nd Ship": "Comandante del 2.º barco",
    "Chief of Staff": "Jefe de Estado Mayor",
}

# Estado. "vivant" (frances) y "living" (ingles) significan lo mismo; se
# unifican para que la ficha no muestre dos estados distintos.
STATUS_ES = {
    "vivant": "Vivo",
    "living": "Vivo",
    "deceased": "Fallecido",
}

# Tipo de fruta.
FRUIT_TYPE_ES = {
    "Zoan Mythique": "Zoan Mítica",
    "Zoan": "Zoan",
    "Paramecia": "Paramecia",
    "Logia": "Logia",
}

# Nombre de la fruta. Se traduce la parte descriptiva y se conservan los
# nombres propios; no se inventan nombres japoneses que la API no da.
FRUIT_NAME_ES = {
    "Hito Hito no Mi, Nika model": "Fruta Hito Hito, modelo Nika",
    "Fruit of the Human": "Fruta de la Humanidad",
    "Fruit Des Éclosions": "Fruta de la Floración",
    "Fruit of the Resurrection": "Fruta de la Resurrección",
    "Fruit of the Scalpel": "Fruta del Escalpelo",
    "Passion fruit": "Fruta de la Pasión",
    "Fruit of Souls": "Fruta de las Almas",
    "Fruit of the Fish, Azure Dragon version": "Fruta del Pez, modelo Dragón Azul",
    "Pyro-Fruit": "Fruta Piro (Fuego)",
    "Fruit du Fil": "Fruta del Hilo",
}


def _translate(mapping, value):
    """Traduce un valor contra un diccionario.

    Devuelve None si no hay valor, y el texto ORIGINAL si no esta en el mapa.
    Centralizar la logica aqui evita repetir el mismo patron en cada traductor.
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return mapping.get(text, text)


def translate_crew(value):
    return _translate(CREW_ES, value)


def translate_job(value):
    return _translate(JOB_ES, value)


def translate_status(value):
    return _translate(STATUS_ES, value)


def translate_fruit_type(value):
    return _translate(FRUIT_TYPE_ES, value)


def translate_fruit_name(value):
    return _translate(FRUIT_NAME_ES, value)


def translate_age(value):
    """La edad viene como "19 ans" (frances).

    Se cambia el sufijo por "años" y se respeta cualquier otro formato
    ("años", "years", numeros sueltos). La expresion regular solo sustituye el
    sufijo al final, asi que un valor como "Edad desconocida" se queda intacto
    en vez de vaciarse.
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    # \s*$ ancla al final; (ans|years?) cubre "ans", "year" y "years".
    import re

    return re.sub(r"\s*(ans|years?)\s*$", " años", text, flags=re.IGNORECASE)

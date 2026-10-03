# ---------------------------------------------------------------------------
# NORMALIZACION DE NOMBRES
#
# Regla unica: minusculas, sin acentos, sin puntuacion y sin el sufijo
# "/ Alias" que usa la API (ejemplo: 'Charlotte Linlin / Big Mom').
#
# Esto es lo que hace que 'Tony-Tony Chopper', 'tony tony chopper' y
# 'tonytonychopper' colisionen en la MISMA clave. El usuario escribe como le
# salga y el servidor encuentra igual.
#
# IMPORTANTE: esta funcion tiene que producir EXACTAMENTE la misma clave que
# su gemela en JavaScript (pokemon-service/src/lib/normalize.js). Las columnas
# search_key que ya estan guardadas en PostgreSQL se calcularon con esa regla;
# si aqui se normalizara distinto, las busquedas dejarian de encontrar los
# registros existentes. Por eso se reproduce paso por paso el orden del JS.
# ---------------------------------------------------------------------------

import re
import unicodedata


def normalize_name(value):
    """Devuelve la clave de busqueda normalizada de un nombre.

    Se hace el mismo recorrido que el JS, en el mismo orden, para no introducir
    diferencias sutiles (por ejemplo, el JS corta el alias ANTES de bajar a
    minusculas; hacerlo al reves daria el mismo resultado en la mayoria de
    casos, pero no hay razon para arriesgarse).
    """
    text = "" if value is None else str(value)

    # 1. Se queda con la parte de antes de "/": la API agrega alias asi.
    text = text.split("/")[0]

    # 2. Minusculas para que la comparacion no dependa de mayusculas.
    text = text.lower()

    # 3. Separa cada letra de su acento (NFD) y elimina las marcas de acento.
    #    Asi 'Jinbe' y 'Jinbé' producen la misma clave.
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))

    # 4. Elimina todo lo que no sea letra a-z o digito. Los espacios, guiones,
    #    puntos y comas desaparecen: por eso 'D. Water' y 'D Water' coinciden.
    text = re.sub(r"[^a-z0-9]+", "", text)

    return text.strip()

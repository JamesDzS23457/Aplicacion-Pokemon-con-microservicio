# Paquete `external`: la UNICA capa autorizada a salir a internet.
#
# IMPORTANTE: estos modulos los importa SOLO el seed (seed.py), nunca main.py.
# Eso garantiza que el servicio en tiempo de peticion no tenga siquiera
# cargado el cliente HTTP: es imposible que salga a internet al buscar.

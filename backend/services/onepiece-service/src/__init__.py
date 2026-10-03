# Marca `src` como paquete de Python para poder importar `src.main`, `src.db`,
# etc. desde el servicio (uvicorn) y desde el seed (seed.py). Sin este archivo,
# los imports relativos entre carpetas fallan.

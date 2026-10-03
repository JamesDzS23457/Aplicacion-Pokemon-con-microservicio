# ---------------------------------------------------------------------------
# ERRORES DE NEGOCIO
#
# El service no conoce HTTP: en lugar de devolver una respuesta, lanza un
# ApiError con el codigo que corresponde (400 si falta el nombre, 404 si no
# existe). main.py tiene un manejador que traduce ese error a JSON, igual que
# hacia el middleware de errores de Express.
#
# Se centraliza aqui para que la regla "400 de quien llama, 404 de dato
# ausente" viva en un solo sitio y no se repita en cada ruta.
# ---------------------------------------------------------------------------


class ApiError(Exception):
    """Error controlado con un codigo HTTP y un mensaje para el cliente."""

    def __init__(self, status, message):
        # Se pasa el mensaje a Exception para que aparezca en los logs y en
        # cualquier traza, pero el handler usa los atributos explicitos.
        super().__init__(message)
        self.status = status
        self.message = message

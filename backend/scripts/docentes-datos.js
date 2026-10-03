// ---------------------------------------------------------------------------
// DATOS DEL SEED DE DOCENTES
//
// -----------------------------------------------------------------------------
// POR QUE HAY UN SOLO DOCENTE
// -----------------------------------------------------------------------------
// Este archivo contenia antes 20 registros INVENTADOS, para que la aplicacion
// se viera completa desde el primer arranque. Esos nombres ya no estan: la base
// de datos de destino tiene que contener unicamente a la persona real de la que
// se dio autorizacion, asi que el archivo se reduce a ese unico registro.
//
// Consecuencia practica de usar datos reales: hay que protegerlos. `.env` esta
// en `.gitignore` y este archivo NO lleva direccion de correo ni foto de nadie
// que no se haya autorizado expresamente para publicar.
//
// Para agregar o quitar docentes despues NO hace falta tocar codigo:
//   1. Inserta o borra la fila desde el Table Editor de Supabase, escribiendo
//      solo las columnas legibles (nombre, cargo, carrera, departamento...).
//      Las claves `search_key`, `carrera_key` y `departamento_key` se rellenan
//      solas por el trigger `docentes_search_keys`.
//   2. Vuelve a la app y pulsa "Actualizar" (o pull-to-refresh, o vuelve a la
//      pestana): el cambio se ve de inmediato.
// El limite de 20 lo impone la base de datos, asi que no puede haber mas de 20.
//
// Este archivo sigue existiendo para poder RESETEAR la base con un comando
// (`npm run backend:seed:docentes`) sin abrir el panel de Supabase. Para el uso
// normal, editar la tabla a mano es lo recomendado.
//
// -----------------------------------------------------------------------------
// QUE SIGNIFICA CADA CAMPO
// -----------------------------------------------------------------------------
//   id          Numero fijo y estable. Es el que usa el boton "Leer mas" para
//               pedir la ficha (path param /api/docentes/:id), asi que conviene
//               no cambiarlo una vez publicado.
//   nombre      Nombre y apellido. Genera el search_key (ver lib/normalize.js).
//   cargo       Titulo del puesto.
//   departamento, carrera, facultad   Donde trabaja y que teachings.
//   email       Contacto institucional. Opcional.
//   foto_url    Foto publica. Opcional: si va en null o la URL falla, la app
//               dibuja las iniciales sobre el color de la facultad.
//   resumen     Parrafo corto: es lo que se ve en la tarjeta de la pestana,
//               recortado a 3 lineas. TIENE que ser mas corto que `biografia`,
//               o el boton "Leer mas" no tendria sentido.
//   biografia   Texto largo: se muestra entero en app/docente/[id].tsx.
//   areas       Lista de areas en las que trabaja (se guarda como JSON en TEXT).
//   formacion   Lista de titulos (se guarda como JSON en TEXT).
// -----------------------------------------------------------------------------

export const DOCENTES = [
  {
    id: 1,
    nombre: 'Elfar Didier Morantes Sánchez',
    cargo: 'Profesional Universitario e Ingeniero de Software',
    departamento: 'Dirección de Medios y Nuevas Tecnologías',
    carrera: 'Ingeniería Electrónica',
    facultad: null,
    email: null,
    foto_url: null,
    resumen:
      'Ingeniero Electrónico colombiano, especialista en Ingeniería de Software y magíster en Educación y E-Learning. Desarrolla software e imparte clases de programación y desarrollo tecnológico.',
    biografia: [
      'Elfar Didier Morantes Sánchez es un Ingeniero Electrónico colombiano, especialista en Ingeniería de Software, magíster en Educación y E-Learning, y desarrollador de software.',
      '',
      'Su perfil profesional y actividades principales incluyen:',
      '',
      '• Trayectoria en el sector público: Se desempeña como profesional universitario e ingeniero de software para la Gobernación de Cundinamarca, específicamente vinculado a la Dirección de Medios y Nuevas Tecnologías de la Secretaría de Educación.',
      '',
      '• Docencia y formación: Cuenta con más de diez años de experiencia como instructor del Servicio Nacional de Aprendizaje (SENA) y como profesor universitario, dictando clases de programación y desarrollo tecnológico.',
      '',
      '• Creador de contenido: Administra un Canal de YouTube enfocado en la enseñanza de lenguajes de programación como Java, Python, PHP y C#, además de tutoriales sobre lógica y despliegue de bases de datos.',
    ].join('\n'),
    areas: [
      'Programación',
      'Desarrollo tecnológico',
      'Lenguajes de programación (Java, Python, PHP, C#)',
      'Lógica y bases de datos',
      'Creación de contenido educativo',
    ],
    formacion: [
      'Ingeniero Electrónico',
      'Especialista en Ingeniería de Software',
      'Magíster en Educación y E-Learning',
    ],
  },
];
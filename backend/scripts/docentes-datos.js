// ---------------------------------------------------------------------------
// DATOS DEL SEED DE DOCENTES  (los 20 registros)
//
// ESTOS DATOS SON DE DEMOSTRACION.
//
// Los nombres, los cargos y los textos de este archivo son INVENTADOS: sirven
// para que la aplicacion se vea completa desde el primer arranque, pero NO son
// los docentes reales de Uninpahu. Publicar datos personales de personas reales
// sin su autorizacion es un problema legal y etico, asi que este archivo se
// reemplaza por los datos reales en cuanto los tengas autorizados:
//
//   1. Sustituye cada objeto por los datos reales (o borra los que sobren).
//   2. Corre "npm run backend:seed:docentes" para volver a cargar.
//   3. El limite de 20 lo impone la base de datos, asi que el archivo no puede
//      tener mas de 20 entradas.
//
// Que la app funcione con datos de mentira es correcto y no es un atajo: es lo
// que permite desarrollar y defender el proyecto sin depender de datos
// personales reales. Lo que NO se debe hacer es presentar estos nombres como los
// docentes de la facultad.
//
// -----------------------------------------------------------------------------
// QUE SIGNIFICA CADA CAMPO
// -----------------------------------------------------------------------------
//   id          Numero fijo y estable. Es el que usa el boton "Leer mas" para
//               pedir la ficha (path param /api/docentes/:id), asi que conviene
//               no cambiarlo una vez publicado.
//   nombre      Nombre y apellido. Genera el search_key (ver lib/normalize.js).
//   cargo       Titulo del puesto.
//   departamento, carrera, facultad   Donde trabaja y que teaches.
//   email       Dejalo en null si no quieres publicarlo: es dato personal.
//   foto_url    URL publica de la foto, o null. Con null la app dibuja un retrato
//               de reserva, para que la pantalla nunca se vea rota.
//   resumen     Descripcion BREVE: la de la tarjeta de la pestana, encima del
//               boton "Leer mas". Una o dos frases.
//   biografia   Descripcion COMPLETA: la de la pantalla de detalle. Puede llevar
//               saltos de linea, con \n en el texto de JavaScript.
//   areas       Lista de areas de trabajo o de investigacion.
//   formacion  Lista de formacion academica, de mayor a menor grado.
// ---------------------------------------------------------------------------

export const DOCENTES = [
  {
    id: 1,
    nombre: 'Ana Beatriz Ríos Álvarez',
    cargo: 'Profesora Titular',
    departamento: 'Departamento de Matemática',
    carrera: 'Ingeniería en Sistemas',
    facultad: 'Facultad de Ingeniería',
    email: 'rios.ana@uninpahu.edu.py',
    resumen:
      'Docente del área de Cálculo diferencial e integral, con enfoque en modelado numérico aplicado a la ingeniería.',
    biografia:
      'Docente de la Facultad de Ingeniería desde hace más de quince años. Dicta ' +
      'Cálculo diferencial, Cálculo integral y Estadística aplicada a las carreras ' +
      'de ingeniería.\n\n' +
      'Su trabajo se concentra en el modelado numérico de problemas de ingeniería y ' +
      'en la formación de docentes de matemática para el nivel secundario. Coordina ' +
      'el taller de herramientas de cálculo que se dicta cada año con los estudiantes ' +
      'de primer año, y ha publicado artículos sobre el método numérico aplicado a ' +
      'la resolución de sistemas de ecuaciones en ingeniería civil.',
    areas: ['Modelado numérico', 'Métodos numéricos', 'Didáctica de la matemática'],
    formacion: [
      'Doctorado en Matemática Aplicada, Universidad Nacional de Asunción',
      'Licenciatura en Matemática, Universidad Nacional de Asunción',
    ],
  },
  {
    id: 2,
    nombre: 'Carlos Andrés Villalba Sosa',
    cargo: 'Professor Adjunto',
    departamento: 'Departamento de Programación',
    carrera: 'Ingeniería en Sistemas',
    facultad: 'Facultad de Ingeniería',
    email: 'villalba.carlos@uninpahu.edu.py',
    resumen:
      'Profesor de Algoritmos y Estructuras de Datos; trabaja en arquitectura de software y calidad de código.',
    biografia:
      'Profesor del Departamento de Programación. Dicta Algoritmos y Estructuras de ' +
      'Datos, Programación Orientada a Objetos y Bases de Datos.\n\n' +
      'Lleva más de diez años en la docencia y forma parte de los proyectos de ' +
      'extensión universitaria que dictan cursos de programación a jóvenes de los ' +
      'barrios del departamento. Su interés de investigación es la arquitectura de ' +
      'software y las prácticas de ingeniería de software en equipos pequeños.',
    areas: ['Arquitectura de software', 'Ingeniería de software', 'Algoritmos'],
    formacion: [
      'Maestría en Ingeniería de Software, Universidad Nacional de Asunción',
      'Licenciatura en Ciencias de la Computación, Universidad Nacional de Itapúa',
    ],
  },
  {
    id: 3,
    nombre: 'Mirtha Noemí García Benítez',
    cargo: 'Profesora Titular',
    departamento: 'Departamento de Química y Bromatología',
    carrera: 'Ingeniería en Alimentos',
    facultad: 'Facultad de Ciencias Exactas y Naturales',
    email: 'garcia.mirtha@uninpahu.edu.py',
    resumen:
      'Docente de Química de Alimentos y Bromatología; investiga la conservación de productos de la región.',
    biografia:
      'Titular del Departamento de Química y Bromatología. Dicta Química de Alimentos, ' +
      'Microbiología de Alimentos y Análisis Bromatológico.\n\n' +
      'Dirige una línea de investigación sobre técnicas de conservación de productos ' +
      'locales, con énfasis en frutas de la región. Publica en revistas de ciencia y ' +
      'tecnología de alimentos y acompaña proyectos de extensión con productores del ' +
      'departamento para el uso de técnicas de conservación a pequeña escala.',
    areas: ['Bromatología', 'Conservación de alimentos', 'Microbiología'],
    formacion: [
      'Doctorado en Ciencias de los Alimentos, Universidad Nacional de Córdoba',
      'Licenciatura en Química, Universidad Nacional de Asunción',
    ],
  },
  {
    id: 4,
    nombre: 'Jorge Luis Ojeda Franco',
    cargo: 'Professor Adjunto',
    departamento: 'Departamento de Electrónica',
    carrera: 'Ingeniería Electrónica',
    facultad: 'Facultad de Ingeniería',
    email: 'ojeda.jorge@uninpahu.edu.py',
    resumen:
      'Profesor de Electrónica Digital y Microcontroladores; armó el laboratorio de instrumentación.',
    biografia:
      'Profesor del Departamento de Electrónica. Dicta Electrónica Digital, ' +
      'Microcontroladores y Sistemas Embebidos.\n\n' +
      'Es responsable del laboratorio de instrumentación, donde los estudiantes de ' +
      'tercer y cuarto año desarrollan sus proyectos finales. Su trabajo se orienta a ' +
      'la instrumentación de medición y a los sistemas embebidos aplicados a la ' +
      'agricultura de precisión.',
    areas: ['Sistemas embebidos', 'Instrumentación', 'Electrónica digital'],
    formacion: [
      'Maestría en Ingeniería Electrónica, Universidad Nacional de Asunción',
      'Licenciatura en Ingeniería Electrónica, Universidad Nacional de Itapúa',
    ],
  },
  {
    id: 5,
    nombre: 'Silvana Rachelle Acosta Duarte',
    cargo: 'Profesora Adjunta',
    departamento: 'Departamento de Diseño y Comunicación',
    carrera: 'Diseño Gráfico',
    facultad: 'Facultad de Ciencias Sociales y Comunicación',
    email: 'acosta.silvana@uninpahu.edu.py',
    resumen:
      'Profesora de Diseño Gráfico y Tipografía; trabaja en identidad visual para proyectos comunitarios.',
    biografia:
      'Docente de la carrera de Diseño Gráfico. Dicta Tipografía, Diseño Editorial y ' +
      'Identidad Visual.\n\n' +
      'Ha dirigido identidad y layout editorial para cooperativas locales y ' +
      'organizaciones de la sociedad civil. Su enfoque es el diseño con ' +
      'funcionalidad social: piezas que se puedan imprimir en el barrio, con los ' +
      'medios disponibles, y que sirvan de verdad.',
    areas: ['Identidad visual', 'Tipografía', 'Diseño editorial'],
    formacion: [
      'Maestría en Diseño Visual, Universidad Nacional de Asunción',
      'Licenciatura en Diseño Gráfico, Universidad Nacional de Itapúa',
    ],
  },
  {
    id: 6,
    nombre: 'Pedro Damián Escurra Cancela',
    cargo: 'Professor Titular',
    departamento: 'Departamento de Agronomía',
    carrera: 'Ingeniería en Agricultura',
    facultad: 'Facultad de Ingeniería',
    email: 'escurra.pedro@uninpahu.edu.py',
    resumen:
      'Titular del Departamento de Agronomía; investiga los suelos de la región y los cultivos de verano.',
    biografia:
      'Profesor Titular del Departamento de Agronomía, con más de veinte años de ' +
      'experiencia docente.\n\n' +
      'Su investigación se centra en la caracterización de suelos del sur del país y ' +
      'en la búsqueda de formas de cultivo más productivas para pequeñas ' +
      'explotaciones. Acompaña a cooperativas de productores en el diseño de ensayos ' +
      'de campo y en la interpretación de sus resultados.',
    areas: ['Edafología', 'Agronecrosis', 'Suelos de la región'],
    formacion: [
      'Doctorado en Ciencias Agronómicas, Universidad de Buenos Aires',
      'Ingeniero Agrónomo, Universidad Nacional de Asunción',
    ],
  },
  {
    id: 7,
    nombre: 'Lucía Fabiola Maidana Torres',
    cargo: 'Profesora Adjunta',
    departamento: 'Departamento de Administración',
    carrera: 'Administración',
    facultad: 'Facultad de Ciencias Económicas, Administrativas y Contables',
    email: 'maidana.lucia@uninpahu.edu.py',
    resumen:
      'Profesora de Gestión de Personas y Organización; se especializa en emprendimiento joven.',
    biografia:
      'Docente de la Facultad de Ciencias Económicas, Administrativas y Contables. ' +
      'Dicta Gestión de Personas, Organización y Métodos de Administración.\n\n' +
      'Coordina el taller de emprendimiento que la facultad ofrece a estudiantes de ' +
      'todas las carreras. Su trabajo de investigación se centra en las dinámicas de ' +
      'emprendimiento joven en el interior del país.',
    areas: ['Gestión de personas', 'Emprendimiento', 'Organización'],
    formacion: [
      'Maestría en Administración de Empresas, Universidad Nacional de Asunción',
      'Licenciatura en Administración, Universidad Nacional de Asunción',
    ],
  },
  {
    id: 8,
    nombre: 'Hugo Nelson Benday Ogier',
    cargo: 'Professor Adjunto',
    departamento: 'Departamento de Contabilidad',
    carrera: 'Contaduría',
    facultad: 'Facultad de Ciencias Económicas, Administrativas y Contables',
    email: 'benday.hugo@uninpahu.edu.py',
    resumen:
      'Profesor de Contabilidad de Costos y Contabilidad Financiera; prepara a los estudiantes para los exámenes de habilitación profesional.',
    biografia:
      'Profesor del Departamento de Contabilidad. Dicta Contabilidad General, ' +
      'Contabilidad de Costos y Contabilidad Financiera.\n\n' +
      'Acompaña durante varios años el programa de preparación para los exámenes de ' +
      'habilitación profesional de la carrera. Su interés está en la contabilidad ' +
      'de costos aplicada a pequeñas y medianas empresas del departamento.',
    areas: ['Contabilidad de costos', 'Contabilidad financiera', 'Control de gestión'],
    formacion: [
      'Maestría en Ciencias Económicas, Universidad Nacional de Asunción',
      'Licenciatura en Contaduría, Universidad Nacional de Itapúa',
    ],
  },
  {
    id: 9,
    nombre: 'Gloria Mabel Bentancur Duarte',
    cargo: 'Profesora Titular',
    departamento: 'Departamento de Comunicación Social',
    carrera: 'Comunicación Social',
    facultad: 'Facultad de Ciencias Sociales y Comunicación',
    email: 'bentancur.gloria@uninpahu.edu.py',
    resumen:
      'Titular del Departamento de Comunicación Social; se especializa en comunicación comunitaria y medios locales.',
    biografia:
      'Profesora Titular del Departamento de Comunicación Social. Dicta Teoría de la ' +
      'Comunicación, Comunicación Comunitaria y Semiótica.\n\n' +
      'Ha investigado durante más de una década el papel de las radios comunitarias ' +
      'del interior del país como espacios de participación. Publica sobre comunicación ' +
      'comunitaria en revistas nacionales y regionales, y coordina la red de radios ' +
      'del departamento.',
    areas: ['Comunicación comunitaria', 'Medios locales', 'Semiótica'],
    formacion: [
      'Doctorado en Ciencias de la Comunicación, Universidad Nacional de Asunción',
      'Licenciatura en Comunicación Social, Universidad Nacional de Asunción',
    ],
  },
  {
    id: 10,
    nombre: 'Osvaldo Ramón Velázquez Cardozo',
    cargo: 'Professor Adjunto',
    departamento: 'Departamento de Geología',
    carrera: 'Ingeniería Geológica',
    facultad: 'Facultad de Ciencias Exactas y Naturales',
    email: 'velazquez.osvaldo@uninpahu.edu.py',
    resumen:
      'Profesor de Geología Aplicada y Geofísica; estudia el recurso subterráneo del sur del país.',
    biografia:
      'Profesor del Departamento de Geología. Dicta Geología General, Geología ' +
      'Aplicada y Geofísica.\n\n' +
      'Trabaja en el estudio del recurso subterráneo regional y en la evaluación de ' +
      'embals subterraneos. Participa en el equipo técnico de proyectos de agua ' +
      'potable para comunidades rurales del departamento.',
    areas: ['Geofísica', 'Hidrogeología', 'Recursos minerales'],
    formacion: [
      'Maestría en Geociencias, Universidad Nacional de Asunción',
      'Licenciatura en Geología, Universidad Nacional de Asunción',
    ],
  },
  {
    id: 11,
    nombre: 'Nilsa Elisabeth Ávalos Monges',
    cargo: 'Profesora Adjunta',
    departamento: 'Departamento de Trabajo Social',
    carrera: 'Trabajo Social',
    facultad: 'Facultad de Ciencias Sociales y Comunicación',
    email: 'avalos.nilsa@uninpahu.edu.py',
    resumen:
      'Profesora de Políticas Sociales y Práctica Profesional; trabaja con políticas de protección a la infancia.',
    biografia:
      'Docente de la carrera de Trabajo Social. Dicta Políticas Sociales, ' +
      'Investigación Social y Práctica Profesional.\n\n' +
      'Acompaña procesos de intervención con familias y con la red de protección a ' +
      'la infancia del departamento. Su investigación se centra en las políticas ' +
      'sociales y en el acceso efectivo de la población rural a los servicios.',
    areas: ['Políticas sociales', 'Protección a la infancia', 'Investigación social'],
    formacion: [
      'Maestría en Trabajo Social, Universidad Nacional de Asunción',
      'Licenciatura en Trabajo Social, Universidad Nacional de Itapúa',
    ],
  },
  {
    id: 12,
    nombre: 'Wilson Fabián Insfrán Franco',
    cargo: 'Professor Titular',
    departamento: 'Departamento de Civil',
    carrera: 'Ingeniería Civil',
    facultad: 'Facultad de Ingeniería',
    email: 'insfran.wilson@uninpahu.edu.py',
    resumen:
      'Titular del Departamento de Ingeniería Civil; especialista en hormigón armado y en obras de drenaje.',
    biografia:
      'Profesor Titular del Departamento de Civil, con más de veinticinco años en la ' +
      'docencia universitaria.\n\n' +
      'Dicta Hormigón Armado, Resistencia de Materiales y Caminos. Ha dirigido ' +
      'cálculos estructurales de obras de infraestructura en la región y participa en la ' +
      'revisión de proyectos de drenaje urbano. Su preocupación principal es la ' +
      'calidad de la obra pública y la formación técnica de los ingenieros jóvenes.',
    areas: ['Hormigón armado', 'Resistencia de materiales', 'Infraestructura vial'],
    formacion: [
      'Doctorado en Ingeniería Civil, Universidad Nacional de Asunción',
      'Ingeniero Civil, Universidad Nacional de Asunción',
    ],
  },
  {
    id: 13,
    nombre: 'Katia Noemí Monges Gavilán',
    cargo: 'Profesora Adjunta',
    departamento: 'Departamento de Epidemiología',
    carrera: 'Licenciatura en Salud Pública',
    facultad: 'Facultad de Ciencias de la Salud',
    email: 'monges.katia@uninpahu.edu.py',
    resumen:
      'Profesora de Epidemiología y Salud Pública; estudia enfermedades transmisibles en zonas rurales.',
    biografia:
      'Docente de la Facultad de Ciencias de la Salud. Dicta Epidemiología, ' +
      'Salud Pública y Métodos de Investigación.\n\n' +
      'Su trabajo se centra en la vigilancia epidemiológica de enfermedades ' +
      'transmisibles en zonas rurales del departamento. Acompaña a los centros de ' +
      'salud del interior en el diseño de sistemas de registro sanitario, y ha ' +
      'publicado sobre la epidemiología del paludismo en el sur del país.',
    areas: ['Epidemiología', 'Salud pública', 'Enfermedades transmisibles'],
    formacion: [
      'Maestría en Salud Pública, Universidad Nacional de Asunción',
      'Licenciatura en Salud Pública, Universidad Nacional de Itapúa',
    ],
  },
  {
    id: 14,
    nombre: 'Rubén Alcides Miranda Portillo',
    cargo: 'Professor Adjunto',
    departamento: 'Departamento de Procesamiento de Alimentos',
    carrera: 'Ingeniería en Alimentos',
    facultad: 'Facultad de Ingeniería',
    email: 'miranda.ruben@uninpahu.edu.py',
    resumen:
      'Profesor de Ingeniería de Alimentos; investiga el secado de frutas regionales y su vida de anaquel.',
    biografia:
      'Profesor del Departamento de Procesamiento de Alimentos. Dicta Ingeniería de ' +
      'Alimentos, Operaciones Unitarias y Conservación de Alimentos.\n\n' +
      'Investiga el secado de frutas de la región y cómo mejora su vida de anaquel. ' +
      'Su trabajo se realiza junto a productores de frutas de zonas rurales, y ha ' +
      'publicado sobre el efecto de las condiciones de secado en la calidad final del ' +
      'producto.',
    areas: ['Operaciones unitarias', 'Secado de frutas', 'Vida de anaquel'],
    formacion: [
      'Doctorado en Ingeniería de Alimentos, Universidad Nacional de Asunción',
      'Ingeniero en Alimentos, Universidad Nacional de Itapúa',
    ],
  },
  {
    id: 15,
    nombre: 'Sandra Elizabeth Ojeda Ortigoza',
    cargo: 'Profesora Titular',
    departamento: 'Departamento de Matemática',
    carrera: 'Ingeniería Electrónica',
    facultad: 'Facultad de Ingeniería',
    email: 'ojeda.sandra@uninpahu.edu.py',
    resumen:
      'Titular del Departamento de Matemática; dicta Álgebra y Ecuaciones Diferenciales para ingeniería.',
    biografia:
      'Profesora Titular del Departamento de Matemática. Dicta Álgebra, Ecuaciones ' +
      'Diferenciales y Matemática Discreta.\n\n' +
      'Su enfoque docente está en la conexión entre el álgebra y los problemas ' +
      'concretos de la ingeniería: el mismo ejemplo se usa en clase y en el ' +
      'laboratorio. Participa en el grupo de apoyo de matemática para estudiantes de ' +
      'primer año, que es uno de los programas de refuerzo más antiguos de la facultad.',
    areas: ['Álgebra', 'Ecuaciones diferenciales', 'Refuerzo académico'],
    formacion: [
      'Doctorado en Matemática, Universidad Nacional de Asunción',
      'Licenciatura en Matemática, Universidad Nacional de Asunción',
    ],
  },
  {
    id: 16,
    nombre: 'Federico Ramón Samudio Laguna',
    cargo: 'Professor Adjunto',
    departamento: 'Departamento de Electricidad',
    carrera: 'Ingeniería Electrónica',
    facultad: 'Facultad de Ingeniería',
    email: 'samudio.federico@uninpahu.edu.py',
    resumen:
      'Profesor de Electricidad y Energías Renovables; coordina pruebas de instalaciones solares de pequeña escala.',
    biografia:
      'Profesor del Departamento de Electricidad. Dicta Electricidad, Instalaciones ' +
      'Eléctricas y Energías Renovables.\n\n' +
      'Coordina las pruebas de instalaciones solares de pequeña escala que la ' +
      'facultad realiza junto a familias del departamento. Investiga la viabilidad ' +
      'de la energía solar térmica en zona rural.',
    areas: ['Energías renovables', 'Instalaciones eléctricas', 'Electricidad'],
    formacion: [
      'Maestría en Ingeniería Eléctrica, Universidad Nacional de Asunción',
      'Ingeniero Electricista, Universidad Nacional de Asunción',
    ],
  },
  {
    id: 17,
    nombre: 'Marisa Concepción Ferreira Alcántara',
    cargo: 'Profesora Adjunta',
    departamento: 'Departamento de Diseño y Comunicación',
    carrera: 'Diseño Gráfico',
    facultad: 'Facultad de Ciencias Sociales y Comunicación',
    email: 'ferreira.marisa@uninpahu.edu.py',
    resumen:
      'Profesora de Fotografía y Producción Audiovisual; dirige el taller de producción de la facultad.',
    biografia:
      'Docente de la carrera de Diseño Gráfico. Dicta Fotografía, Producción ' +
      'Audiovisual y Diseño Publicitario.\n\n' +
      'Dirige el taller de producción audiovisual de la facultad, donde los ' +
      'estudiantes graban y editan piezas para radios y canales locales. Su trabajo se ' +
      'centra en el uso del audiovisual como herramienta de documentación y de ' +
      'divulgación de conflictos comunitarios.',
    areas: ['Fotografía', 'Producción audiovisual', 'Diseño publicitario'],
    formacion: [
      'Maestría en Artes Visuales, Universidad Nacional de Asunción',
      'Licenciatura en Diseño Gráfico, Universidad Nacional de Itapúa',
    ],
  },
  {
    id: 18,
    nombre: 'Ever Nelson Silvera Ríos',
    cargo: 'Professor Adjunto',
    departamento: 'Departamento de Programación',
    carrera: 'Ingeniería en Sistemas',
    facultad: 'Facultad de Ingeniería',
    email: 'silvera.ever@uninpahu.edu.py',
    resumen:
      'Profesor de Redes de Computadores y Bases de Datos; administra el laboratorio de redes de la facultad.',
    biografia:
      'Profesor del Departamento de Programación. Dicta Redes de Computadores, Bases ' +
      'de Datos y Administración de Sistemas.\n\n' +
      'Administra el laboratorio de redes de la facultad y coordina la preparación de ' +
      'los estudiantes para certificaciones de redes. Su investigación se orienta a ' +
      'la seguridad de redes de pequeña escala y a la administración de servicios en ' +
      'organizaciones del interior.',
    areas: ['Redes de computadores', 'Bases de datos', 'Seguridad informática'],
    formacion: [
      'Maestría en Sistemas Distribuidos, Universidad Nacional de Asunción',
      'Licenciatura en Ingeniería en Sistemas, Universidad Nacional de Itapúa',
    ],
  },
  {
    id: 19,
    nombre: 'Blanca Ramona Lezcano Franco',
    cargo: 'Profesora Titular',
    departamento: 'Departamento de Química y Bromatología',
    carrera: 'Ingeniería en Alimentos',
    facultad: 'Facultad de Ciencias Exactas y Naturales',
    email: 'lezcano.blanca@uninpahu.edu.py',
    resumen:
      'Titular del Departamento de Bromatología; investiga control de calidad en la industria alimentaria regional.',
    biografia:
      'Profesora Titular del Departamento de Química y Bromatología. Dicta Bromatología ' +
      'y Control de Calidad de Alimentos.\n\n' +
      'Trabaja con la industria alimentaria regional en el diseño de sistemas de ' +
      'control de calidad y en la implementación de buenas prácticas de fabricación. ' +
      'Publica sobre trazabilidad de productos frescos.',
    areas: ['Control de calidad', 'Bromatología', 'Trazabilidad'],
    formacion: [
      'Doctorado en Bromatología, Universidad Nacional de Córdoba',
      'Licenciatura en Química Industrial, Universidad Nacional de Asunción',
    ],
  },
  {
    id: 20,
    nombre: 'Óscar Antonio Recalde Marín',
    cargo: 'Profesor Titular',
    departamento: 'Departamento de Civil',
    carrera: 'Ingeniería Civil',
    facultad: 'Facultad de Ingeniería',
    email: 'recalde.oscar@uninpahu.edu.py',
    resumen:
      'Profesor Titular de Hidráulica y Drenaje; dirige el laboratorio de mecánica de fluidos.',
    biografia:
      'Profesor Titular del Departamento de Civil, con veinte años de experiencia ' +
      'docente en la carrera de Ingeniería Civil.\n\n' +
      'Dicta Hidráulica, Mecánica de Fluidos y Drenaje Urbano. Dirige el laboratorio ' +
      'de mecánica de fluidos y lidera la línea de investigación sobre escurrimiento ' +
      'superficial en zonas urbanas del interior del país.',
    areas: ['Hidráulica', 'Mecánica de fluidos', 'Drenaje urbano'],
    formacion: [
      'Doctorado en Ingeniería Hidráulica, Universidad Nacional de Asunción',
      'Ingeniero Civil, Universidad Nacional de Asunción',
    ],
  },
];

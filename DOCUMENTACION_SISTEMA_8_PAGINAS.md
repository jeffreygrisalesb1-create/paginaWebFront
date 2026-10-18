# GUÍA Y EXPLICACIÓN DEL SISTEMA: INEM MOTORS (INEMVENTAS)
> **Resumen para exposición:** Esta guía explica de manera clara, amigable y al grano qué hace cada archivo del proyecto, cómo interactúan entre sí y cómo funciona todo el flujo desde que entra un cliente hasta que la gerencia revisa las ventas.

---

# 1. ¿Qué es este proyecto y para qué sirve?

**Inem Motors** es una página web pensada para un concesionario de autos y repuestos. En lugar de ser solo un catálogo estático, conecta tres partes clave del negocio:

1. **El Cliente:** Puede ver los carros y repuestos en venta, filtrarlos por precio o marca, ver diagnósticos mecánicos de fallas, hacer pedidos y rastrear en qué estado está su compra con su cédula o correo.
2. **El Trabajador:** Entra con su nombre y DNI, revisa los pedidos nuevos que hacen los clientes, los aprueba, les asigna una empresa transportadora o los rechaza con un motivo claro. También añade productos nuevos al inventario.
3. **El Gerente:** Tiene un panel con estadísticas en vivo: cuánto dinero hay invertido en vehículos, cuántos autos se han vendido, qué vendedor rindió más y acceso a todos los formularios del negocio.

---

# 2. ¿Cómo se comunican las partes del sistema? (El Puente API)

Todo el frontend (la página web que ves en pantalla) no guarda los datos directamente en su código; se conecta con un **servidor backend** en `http://localhost:3000/api` usando el archivo [js/api.js](file:///c:/Users/Aleja/Documents/paginaWebINEMVentas/js/api.js).

### ¿Qué hace [api.js](file:///c:/Users/Aleja/Documents/paginaWebINEMVentas/js/api.js)?
Es como el mensajero de la página. Tiene una función principal llamada `solicitarAPI()`:
- Cuando la página necesita los vehículos, le dice: `solicitarAPI('vehiculos')`.
- El mensajero va al servidor, pide los datos en formato JSON y se asegura de que, si ocurre un error (por ejemplo, servidor apagado o dato inválido), no se rompa la pantalla, sino que muestre una alerta amigable al usuario.

---

# 3. ¿Cómo funciona el Acceso y los Roles? ([auth.js](file:///c:/Users/Aleja/Documents/paginaWebINEMVentas/js/auth.js))

En la esquina superior de la página hay un botón llamado **"Acceso Personal"**. Al darle clic se abre una ventana modal con dos perfiles:

* **Si eliges "Trabajador":** Te pide tu nombre completo y tu número de DNI/Cédula. El código consulta la lista de empleados reales en la base de datos. Para evitar errores si alguien escribe con tildes, mayúsculas o espacios de más, el código "limpia" el texto antes de comparar. Si coincide, te deja entrar como trabajador.
* **Si eliges "Gerente":** Pide un usuario y contraseña fija (`GERENTE` / `5678`). Al ingresar, activa la vista ejecutiva con gráficos.
* **Cerrar sesión:** El botón cambia a "Cerrar Sesión", borra al usuario activo y regresa la pantalla a la vista de cliente normal.

---

# 4. El Catálogo Inteligente y el Semáforo de Fallas ([app.js](file:///c:/Users/Aleja/Documents/paginaWebINEMVentas/js/app.js))

El archivo [app.js](file:///c:/Users/Aleja/Documents/paginaWebINEMVentas/js/app.js) es el cerebro visual de la página principal:

### A. Buscador y Filtros al instante:
Mientras vas escribiendo en la barra de búsqueda o cambias un selector (categoría, marca, precio máximo), la función `filtrarCatalogo()` filtra la lista en la memoria del navegador y actualiza las tarjetas sin tener que recargar la página.

### B. El Semáforo Mecánico de Diagnóstico:
Si un vehículo tiene registrada alguna condición o problema en la base de datos, el código lee las palabras clave:
- 🟢 **Verde (Buen estado):** Palabras como *"seminuevo"*, *"sin fallas"*, *"excelente"*.
- 🟡 **Amarillo (Revisión sugerida):** Palabras como *"detalle"*, *"segunda mano"*, *"falla leve"*.
- 🔴 **Rojo (Falla grave):** Palabras como *"averiado"*, *"falla grave"*, *"fuga de frenos"*.
Al dar clic en **"Ver detalles"**, se abre una ficha que le aconseja al cliente qué hacer (por ejemplo: *"No encender hasta revisar el motor"*).

---

# 5. ¿Cómo se realiza una compra y cómo funciona el Stock? ([compra.html](file:///c:/Users/Aleja/Documents/paginaWebINEMVentas/compra.html) y [checkout.js](file:///c:/Users/Aleja/Documents/paginaWebINEMVentas/js/checkout.js))

Cuando el cliente oprime **"Comprar"** en cualquier tarjeta, el sistema lo lleva a la pantalla de compra:

1. **Gestión de Stock en Tiempo Real:** 
   - Los vehículos tienen cantidades más limitadas (ej. 3 a 7 unidades).
   - Los productos, accesorios y repuestos cuentan con stock abundante y variado (ej. 30, 40, 48 unidades según su categoría).
   - **Deducción automática:** En el momento exacto en que se formaliza la compra, el sistema descuenta automáticamente 1 unidad del inventario (ej. si una moto o accesorio tenía 7 unidades, pasa inmediatamente a 6). Si llega a 0, queda marcado como *"Agotado"* y se bloquea su compra.
2. **Ubicación en cascada:** Al seleccionar un País (ej. Colombia), el selector de ciudades se activa y muestra únicamente las ciudades pertenecientes a ese país.
3. **Registro automático:** 
   - El código revisa si el cliente ya existe por su documento. Si no existe, lo crea automáticamente en el sistema.
   - Genera la orden de compra (`/compras`), guarda los artículos seleccionados en sus tablas correspondientes (`/cv` y `/cp`) y crea el envío logístico pendiente (`/envios`).
4. Al finalizar, le entrega al cliente su **Número de Pedido** para que pueda consultarlo cuando quiera.

---

# 6. ¿Cómo se rastrean y gestionan los pedidos?

Este es uno de los puntos fuertes del proyecto porque une al cliente con el trabajador:

### A. Vista del Cliente ("Mis Pedidos"):
- Al escribir su número de **DNI o Cédula**, el sistema reconoce al cliente y lo saluda por su nombre con una tarjeta de bienvenida.
- Muestra una **insignia con la fecha exacta de compra** y el **lapso estimado de entrega** fijado por el concesionario (ej. *10 a 15 días hábiles*).
- Ve una **línea de tiempo visual** con 4 pasos:
  1. Registrado $\rightarrow$ 2. Aprobado $\rightarrow$ 3. En Transporte $\rightarrow$ 4. Entregado.
- Al momento de ser **Entregado**, se despliega la **fecha de llegada y entrega** del paquete.
- *¿Y si le rechazan la compra?* En vez de la línea de tiempo, le sale un aviso rojo explicando exactamente por qué (por ejemplo: *"Comprobante de pago ilegible"* o *"Datos no coinciden"*).

### B. Vista del Trabajador:
El trabajador tiene una tabla con todos los pedidos entrantes:
- Puede **aprobarlos** con un botón.
- Puede elegir el **lapso de entrega estimado** (ej. *24 a 48 horas*, *3 a 5 días*, *10 a 15 días*, *20 a 30 días especiales*).
- Asigna la empresa transportadora (ej. Envía, Servientrega) y escribe el número de guía.
- Si algo está mal, hace clic en **"Rechazar"**, elige el motivo y el cliente lo ve reflejado al instante.

---

# 7. El Panel de Gerencia y Estadísticas

Cuando inicia sesión el Gerente, se activa un tablero de control con gráficos interactivos hechos con la librería **Chart.js**:

* **Valor total del inventario:** Suma el precio de todos los autos multiplicados por sus cantidades para saber cuánto capital hay en bodega.
* **Gráfico de inventario:** Muestra qué porcentaje son carros, repuestos o productos de limpieza.
* **Top 5 más vendidos:** Muestra cuáles modelos han tenido mayor salida.
* **Rendimiento de empleados:** Una tabla que calcula cuántas ventas ha cerrado cada vendedor y cuánto dinero ha aportado al negocio.
* **Acceso a Formularios:** Un enlace a [formularios-gerente.html](file:///c:/Users/Aleja/Documents/paginaWebINEMVentas/formularios-gerente.html), donde se pueden crear o modificar directamente clientes, categorías, ciudades, empleados y vehículos.

---

# 8. Gestor de Fotos y Resumen Técnico

* **[gestor-imagenes.html](file:///c:/Users/Aleja/Documents/paginaWebINEMVentas/gestor-imagenes.html) y [image-store.js](file:///c:/Users/Aleja/Documents/paginaWebINEMVentas/js/image-store.js):** 
  Permite asignar fotos a los vehículos pegando enlaces de internet. Las guarda en la memoria del navegador (`localStorage`) y tiene un botón para exportar un archivo `data/imagenes.json` listo para guardar en Git.
* **Tecnologías usadas:**
  - **HTML5:** Estructura modular de todas las páginas.
  - **CSS3 Puro:** Diseño moderno en modo oscuro con efectos visuales, tarjetas y animaciones sin depender de librerías pesadas.
  - **JavaScript Vanilla (ES6+):** Lógica asíncrona (`fetch`, `async/await`), eventos en vivo y manipulación rápida del DOM.
  - **Chart.js:** Gráficos estadísticos claros y responsivos.

---

### Resumen para decir en tu exposición (en 30 segundos):
> *"Nuestro proyecto es una plataforma completa para concesionarios de autos. Integra una tienda virtual donde los clientes ven diagnósticos mecánicos de los vehículos y compran con seguimiento en tiempo real de su paquete; un portal para que los trabajadores aprueben pedidos y gestionen envíos con transportadoras; y un dashboard gerencial con indicadores financieros y rendimiento de ventas."*

# Simulador Core

Módulo ES común para los simuladores estáticos. Cada asignatura declara sus parámetros y adaptador de interfaz; el core gestiona almacenamiento por perfil, historial, estado recuperable y cálculo de resultados.

La persistencia actual es local-first mediante `localStorage`. El contrato de almacenamiento queda encapsulado para poder sustituir/ampliar el adaptador por IndexedDB y un proveedor cloud autenticado sin rehacer la lógica del examen.

# Objetivo — Bárbara con memoria real

> La visión de producto completa, experiencia de portal, algoritmo de
> aprendizaje, integración MCP/CLI e hitos vive en
> [`VISION-OBJETIVO-FINAL.md`](./VISION-OBJETIVO-FINAL.md). Este documento
> mantiene el fundamento de la memoria en capas.

> Nace como un bebé (memoria semilla del formulario de onboarding) y con
> cada interacción aprende más de su cliente, hasta adaptarse a sus
> patrones sin que nadie tenga que repetírselo. Documento de visión —
> el detalle de negocio va en [ESTRATEGIA.md](./ESTRATEGIA.md), el
> detalle técnico en [STACK-TECNICO.md](./STACK-TECNICO.md).

## La ambición, dicha con honestidad

La idea original que la disparó: "que Bárbara tenga el mejor cerebro del
mundo, mejor que un humano". Vale la pena decir claro qué de eso es
real y qué no, para no vender (ni construir hacia) una promesa que no
se sostiene:

- **No es cierto** que un sistema de memoria haga a un modelo razonar
  mejor. La inteligencia de Bárbara viene de Claude corriendo por
  debajo — ningún archivo `.md`, por bien organizado que esté, cambia
  eso. Prometer "el cerebro más inteligente del mundo" es competir
  contra Anthropic/OpenAI/Google directamente, y esa no es una pelea
  que se gane con una carpeta de memoria.
- **Sí es cierto y sí es defendible**: memoria en capas, aprendizaje
  cruzado entre clientes con umbral anti-contaminación, y una
  biblioteca de conocimiento propio verificado — es una combinación
  que no encontramos replicada en este nicho (bot de marketing en
  WhatsApp/Instagram para pymes de Chile/LatAm) a este precio. Eso sí
  es una ventaja real y sostenible.

El mensaje de venta correcto no es "el cerebro más poderoso del
mundo" — es **"Bárbara aprende tu negocio y mejora sola con el
tiempo, sin que tengas que volver a explicarle nada"**. Es una
promesa más chica, pero es cierta, y las promesas ciertas se sostienen
mejor con años que las grandilocuentes.

## Qué significa "aprender" en concreto

1. **Memoria privada por cliente** — cada corrección, cada resultado
   de campaña, cada preferencia de tono queda guardada y se recupera
   automáticamente la próxima vez que aplica. El cliente nunca repite
   una instrucción dos veces.
2. **Memoria global entre clientes** — patrones generales (no gustos
   personales) que se repiten en varios clientes distintos se
   promueven a conocimiento compartido, anonimizado, sin cruzar datos
   de un cliente a otro directamente.
3. **Biblioteca fundacional propia** — playbooks escritos por Cóndor
   AI, basados en lo que YA se verificó que funciona con datos reales
   propios — no contenido de terceros escaneado (ver la nota legal en
   ESTRATEGIA.md sobre por qué se descartó cargar transcripciones de
   YouTube de expositores).

Prioridad cuando hay conflicto entre las tres capas: **privada > global
> fundacional**, siempre. El gusto específico del cliente gana por
sobre cualquier patrón general.

## Por qué esto y no otra cosa

Casi ningún bot de IA para pymes en la región implementa memoria real
— la mayoría es *stateless*: cada conversación arranca de cero. La
ventaja competitiva de Bárbara no es la técnica (memoria en capas +
recuperación semántica es un campo activo y poblado en la industria de
IA, no lo inventamos nosotros) — es que **casi nadie se molesta en
implementarla bien para este segmento específico de cliente**.

## Camino de construcción

Se construye en fases, vendiendo versiones beta desde ya y creciendo
con el tiempo — no se espera tener el sistema completo para empezar a
cobrar por él. El detalle de fases está en STACK-TECNICO.md.

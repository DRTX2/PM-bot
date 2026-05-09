Probablemente te refieres a patrones de resiliencia/orquestación comunes en automatización y sistemas distribuidos.

Además de **fallback**, los más usados para manejo de errores son:

---

# 1. Fallback

Cuando algo falla, usas una alternativa.

Ejemplo:

```text id="zcqj4z"
Si falla GPT-5 Codex → usar Gemini
Si falla Trello API → usar cache local
```

Uso típico:

* alta disponibilidad
* degradación elegante
* redundancia

---

# 2. Retry

Reintentar automáticamente.

Ejemplo:

* GitHub devuelve `429`
* esperar 5s
* reintentar

Tipos:

* fixed retry
* exponential backoff
* jitter retry

Muy importante para APIs.

---

# 3. Circuit Breaker

Este es probablemente el otro que buscas.

Evita seguir golpeando un servicio roto.

Ejemplo:

```text id="llv8n5"
GitHub API falla 10 veces →
abrir circuit breaker →
detener requests temporalmente
```

Después:

* espera
* prueba recuperación
* reabre tráfico

Muy usado en microservicios.

---

# 4. Dead Letter Queue (DLQ)

Mensajes/tareas fallidas van a una cola especial.

Ejemplo:

```text id="mjlwmw"
PR review falló →
mandar a DLQ →
revisar manualmente luego
```

Muy útil en:

* RabbitMQ
* Kafka
* NATS
* queues AI agents

---

# 5. Timeout

Nunca esperar indefinidamente.

Ejemplo:

```text id="7g7x0s"
Si Gemini tarda >60s →
cancelar task
```

---

# 6. Graceful Degradation

El sistema sigue funcionando parcialmente.

Ejemplo:

```text id="9cfd6u"
Sin métricas avanzadas,
pero dashboard sigue operativo
```

---

# 7. Rollback

Revertir cambios automáticamente.

Ejemplo:

* deploy rompe tests
* rollback inmediato

---

# 8. Compensation Pattern / Saga

En workflows largos.

Ejemplo:

```text id="n6a0rv"
Crear card Trello OK
Crear branch GitHub falla
→ eliminar card creada
```

Muy importante en sistemas multi-step.

---

# 9. Bulkhead

Aislar componentes para que un fallo no destruya todo.

Ejemplo:

```text id="p0g1xt"
Agentes reviewer separados de deployment agents
```

---

# 10. Health Checks

Verificar continuamente estado del sistema.

Ejemplo:

* GitHub API latency
* CI/CD status
* agent alive checks

---

# Para tu Project Manager AI

Los MÁS importantes serían:

| Patrón               | Prioridad  |
| -------------------- | ---------- |
| Retry + backoff      | crítica    |
| Circuit breaker      | crítica    |
| Fallback             | crítica    |
| Timeout              | crítica    |
| DLQ                  | alta       |
| Rollback             | alta       |
| Health checks        | alta       |
| Graceful degradation | media      |
| Saga/compensation    | media-alta |

---

# Cómo podrías pedirlo en el prompt

Agrega algo como:

```text id="uhq1od"
Implementa patrones de resiliencia y manejo de errores profesionales incluyendo:
- retry con exponential backoff
- circuit breaker
- fallback providers
- graceful degradation
- dead letter queues
- timeouts
- rollback automático
- health checks
- observabilidad y alerting

El sistema debe tolerar fallos parciales sin comprometer la operación global.
```

Eso ya suena bastante enterprise/SRE-level.


Sí, **sí hay información financiera útil** en los documentos. La información más directa está en el **Project Charter**, el **Contrato de Servicios Cloud VPS** y la **Matriz de Evaluación de Proveedores**. El archivo de “datos programa veterinario” solo tiene cronogramas de vacunación e historia clínica, no contiene costos ni presupuesto.

## 1. Presupuesto general del proyecto PetSafe

En el **Project Charter** aparece un **Resumen Financiero** con el costo total estimado del proyecto. El documento indica que el cálculo integra costos directos del desarrollo y costos indirectos necesarios para ejecutar el proyecto. 

| Concepto                              | Descripción                                                                                                 | Costo estimado |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------: |
| Recursos Humanos                      | Trabajo del equipo de desarrollo durante 16 semanas, incluyendo frontend, backend y gestión del proyecto.   |  **$2.368,00** |
| Recursos Tecnológicos                 | Herramientas de desarrollo, equipos de trabajo e infraestructura cloud para implementación y despliegue.    |    **$140,00** |
| Costos Indirectos                     | Capacitación al cliente, conectividad a Internet, consumo eléctrico, transporte para reuniones y papelería. |    **$250,00** |
| **Costo total estimado del proyecto** | Suma general del presupuesto del proyecto.                                                                  |  **$2.758,00** |

**Total del proyecto:** **$2.758,00**. 

---

## 2. Detalle de costos de recursos humanos

El Project Charter desglosa el costo del equipo de trabajo así:

| Categoría                  | Integrantes                     | Cálculo                                            |         Costo |
| -------------------------- | ------------------------------- | -------------------------------------------------- | ------------: |
| Personal – Frontend        | Manjarres David, Barragán David | 2 desarrolladores × 8 h/semana × 16 semanas × $4/h | **$1.024,00** |
| Personal – Backend         | García Josué, Bonilla Joel      | 2 desarrolladores × 8 h/semana × 16 semanas × $4/h | **$1.024,00** |
| Gestión de Proyecto        | Bonilla Joel                    | 4 h/semana × 16 semanas × $5/h                     |   **$320,00** |
| **Total recursos humanos** |                                 |                                                    | **$2.368,00** |

Esta es la parte más fuerte del presupuesto: los **recursos humanos representan $2.368,00 de $2.758,00**, es decir, aproximadamente el **85,86 %** del costo total del proyecto. 

---

## 3. Detalle de recursos tecnológicos

El documento también incluye una sección de **Recursos Tecnológicos**, donde se identifican herramientas, hardware e infraestructura en la nube. 

| Categoría                       | Recurso                                                                         |       Costo |
| ------------------------------- | ------------------------------------------------------------------------------- | ----------: |
| Software                        | Angular, NestJS, PostgreSQL, Git, VSCode y Flutter                              |   **$0,00** |
| Hardware                        | Equipos de trabajo del equipo de desarrollo y dispositivos móviles para pruebas |  **$80,00** |
| Infraestructura en la nube      | Servidor virtual para frontend, backend y base de datos                         |  **$60,00** |
| **Total recursos tecnológicos** |                                                                                 | **$140,00** |

Ojo: en una parte de la tabla aparece “Total recursos tecnológicos $40,00”, pero el texto inmediatamente después dice que el costo total asociado a recursos tecnológicos asciende a **140 USD**. Además, **80 + 60 = 140**, por lo que el valor coherente para usar en tu programa es **$140,00**. 

---

## 4. Costos indirectos del proyecto

El Project Charter resume los **costos indirectos** en una sola categoría:

| Categoría         | Descripción                                                                                                |       Costo |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ----------: |
| Costos Indirectos | Capacitación al cliente, conectividad a Internet, consumo eléctrico, transporte para reuniones y papelería | **$250,00** |

Este rubro representa aproximadamente el **9,06 %** del presupuesto total. 

---

## 5. Servicio VPS / infraestructura cloud

En el documento **Creación del contrato**, se indica que el proyecto PetSafe requiere contratar un **servicio cloud tipo VPS** con el proveedor **Contabo GmbH** para el despliegue y operación del sistema. El contrato busca establecer condiciones técnicas, legales y operativas, incluyendo forma de pago, SLA, obligaciones, garantías y causales de terminación. 

El VPS se utilizará para:

| Uso del VPS           | Descripción                              |
| --------------------- | ---------------------------------------- |
| Backend               | Despliegue del backend del sistema       |
| Base de datos         | Gestión de la base de datos PostgreSQL   |
| API REST              | Exposición de servicios para web y móvil |
| Operación del sistema | Procesamiento de operaciones de PetSafe  |

El documento indica que el servicio opera bajo **facturación periódica, generalmente mensual**, y que el costo depende de los recursos asignados y la ubicación del servidor. También señala que ese valor referencial sirve como base económica del contrato y para definir obligaciones de pago y viabilidad financiera del servicio. 

---

## 6. Características técnicas del VPS relacionadas con el costo

El contrato define especificaciones mínimas equivalentes para el VPS:

| Recurso           | Especificación        |
| ----------------- | --------------------- |
| CPU               | **4 vCPU**            |
| RAM               | **8 GB**              |
| Almacenamiento    | **75 GB NVMe**        |
| Red               | **200 Mbit/s mínimo** |
| Tráfico           | **No limitado**       |
| Sistema operativo | **Linux / Ubuntu**    |

Estas características justifican el costo de infraestructura cloud porque permiten ejecutar el backend en NestJS, la base de datos PostgreSQL y los servicios API del sistema. 

---

## 7. Condiciones de pago del contrato VPS

El documento del contrato indica que el proceso de contratación incluye:

| Elemento             | Información encontrada                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Tipo de contratación | Servicio tecnológico cloud tipo VPS                                                               |
| Proveedor            | Contabo GmbH                                                                                      |
| Modelo de pago       | Facturación periódica, generalmente mensual                                                       |
| Pago inicial         | Corresponde al primer periodo mensual del servicio, previo a la activación del VPS                |
| Pagos recurrentes    | Asociados a la continuidad mensual del servicio                                                   |
| Obligación económica | El contratante asume las obligaciones económicas y de uso conforme a las condiciones establecidas |

El contrato también indica que el proveedor suministra recursos tecnológicos en la nube y que la parte contratante asume las obligaciones económicas y de uso. 

---

## 8. Evaluación económica de proveedores

En la **Matriz de Evaluación y Adjudicación de Proveedores**, la parte económica sí aparece como criterio formal de evaluación. La matriz incluye una categoría llamada **Propuesta económica**, con estos pesos:

| Categoría                     | Criterio                  |     Peso |
| ----------------------------- | ------------------------- | -------: |
| Propuesta económica           | Costo mensual/anual total |  **7 %** |
| Propuesta económica           | Relación costo-beneficio  |  **3 %** |
| **Total propuesta económica** |                           | **10 %** |

Esto significa que el costo no fue el único factor de selección, pero sí representó un **10 % del puntaje total** dentro de la evaluación de proveedores. 

---

## 9. Proveedor adjudicado por conveniencia económica

La matriz concluye que **Contabo** fue seleccionado como proveedor adjudicado con una puntuación ponderada de **84,60 %**. La razón financiera principal fue su **relación costo-beneficio favorable**, ya que ofrece capacidad de procesamiento, memoria RAM y almacenamiento a un costo accesible frente a otras alternativas evaluadas. 

También se menciona que:

| Proveedor     | Resultado   | Observación económica                                                        |
| ------------- | ----------- | ---------------------------------------------------------------------------- |
| Contabo       | Adjudicado  | Mejor equilibrio entre rendimiento, confiabilidad y costo                    |
| Hostinger     | Adjudicado  | Buen soporte, seguridad y almacenamiento                                     |
| Hetzner       | Condicional | Muy competitivo en precio y privacidad, pero no alcanzó el puntaje requerido |
| OVHcloud      | Condicional | Fuerte en seguridad, pero afectado por costos iniciales y menor conveniencia |
| AWS Lightsail | Condicional | Alta disponibilidad y seguridad, pero plan base limitado en RAM              |
| IONOS         | Condicional | Económico y estable, pero menor desempeño en recursos y escalabilidad        |

Contabo queda como opción más conveniente porque combina **rendimiento, disponibilidad, soporte y costo accesible**. 

---

## 10. Datos listos para usar en tu programa

Puedes cargar esta estructura directamente como datos base:

```json
{
  "proyecto": "PetSafe - Sistema de Gestión Veterinaria",
  "presupuesto_total": 2758.00,
  "moneda": "USD",
  "costos": [
    {
      "categoria": "Recursos Humanos",
      "descripcion": "Trabajo del equipo de desarrollo durante 16 semanas, incluyendo frontend, backend y gestión del proyecto.",
      "monto": 2368.00
    },
    {
      "categoria": "Recursos Tecnológicos",
      "descripcion": "Herramientas de desarrollo, equipos de trabajo y servicios de infraestructura en la nube.",
      "monto": 140.00
    },
    {
      "categoria": "Costos Indirectos",
      "descripcion": "Capacitación al cliente, conectividad a Internet, consumo eléctrico, transporte para reuniones y papelería.",
      "monto": 250.00
    }
  ],
  "detalle_recursos_humanos": [
    {
      "categoria": "Personal Frontend",
      "integrantes": ["Manjarres David", "Barragán David"],
      "calculo": "2 desarrolladores x 8 horas/semana x 16 semanas x 4 USD/hora",
      "monto": 1024.00
    },
    {
      "categoria": "Personal Backend",
      "integrantes": ["García Josué", "Bonilla Joel"],
      "calculo": "2 desarrolladores x 8 horas/semana x 16 semanas x 4 USD/hora",
      "monto": 1024.00
    },
    {
      "categoria": "Gestión de Proyecto",
      "integrantes": ["Bonilla Joel"],
      "calculo": "4 horas/semana x 16 semanas x 5 USD/hora",
      "monto": 320.00
    }
  ],
  "detalle_recursos_tecnologicos": [
    {
      "categoria": "Software",
      "recurso": "Angular, NestJS, PostgreSQL, Git, VSCode y Flutter",
      "monto": 0.00
    },
    {
      "categoria": "Hardware",
      "recurso": "Equipos de trabajo y dispositivos móviles para pruebas",
      "monto": 80.00
    },
    {
      "categoria": "Infraestructura en la nube",
      "recurso": "Servidor virtual para frontend, backend y base de datos",
      "monto": 60.00
    }
  ],
  "proveedor_cloud": {
    "nombre": "Contabo GmbH",
    "servicio": "Cloud VPS",
    "modelo_pago": "Mensual / periódico",
    "uso": ["Backend", "Base de datos", "API REST", "Procesamiento de operaciones"],
    "especificaciones": {
      "cpu": "4 vCPU",
      "ram": "8 GB",
      "almacenamiento": "75 GB NVMe",
      "red": "200 Mbit/s mínimo",
      "trafico": "No limitado",
      "sistema_operativo": "Linux Ubuntu"
    },
    "puntaje_evaluacion": 84.60,
    "estado": "Adjudicado",
    "justificacion": "Relación costo-beneficio favorable, recursos competitivos y costo accesible frente a otras alternativas."
  }
}
```

## Conclusión rápida

La información financiera encontrada sirve perfectamente para tu programa. Los datos clave son:

**Presupuesto total:** **$2.758,00**
**Recursos humanos:** **$2.368,00**
**Recursos tecnológicos:** **$140,00**
**Costos indirectos:** **$250,00**
**Proveedor cloud:** **Contabo GmbH**
**Costo específico de infraestructura cloud en Project Charter:** **$60,00**
**Modelo de pago VPS:** **mensual/periódico**
**Proveedor adjudicado:** **Contabo, 84,60 %** por relación costo-beneficio favorable.

# API HKUST Smart AC - Documentation Technique Complète

## Vue d'ensemble

L'API HKUST Smart AC est un système de gestion et contrôle de climatisation pour les dortoirs de l'Université des Sciences et Technologies de Hong Kong (HKUST). Le système utilise un modèle de **prépaiement par minutes** où les étudiants achètent du temps de climatisation et peuvent contrôler leur unité AC à distance.

### Caractéristiques principales
- **Contrôle ON/OFF** de la climatisation
- **Timer programmable** avec arrêt automatique  
- **Système de prépaiement** basé sur les minutes d'utilisation
- **Monitoring en temps réel** de la consommation électrique
- **Authentification CAS** intégrée avec le système HKUST
- **Mode urgence** pour refroidissement maximal
- **Historique de consommation** et facturation détaillée

---

## Architecture du système

### Base URL
```
https://w5.ab.ust.hk/njggt/api/app
```

### Stack technique
- **Protocole**: HTTPS REST API
- **Format**: JSON
- **Timeout**: 40 secondes par requête
- **Headers requis**: 
  - `Content-Type: application/json`
  - `Accept: application/json`
  - `Authorization: Bearer <token>`
  - `User-Agent`: Simulation mobile iOS Safari

## Configuration et environnement

### Headers HTTP standard
```javascript
{
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Referer': 'https://w5.ab.ust.hk/njggt/app/home',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Authorization': 'Bearer {token}'
}
```

---

## Endpoints de l'API

### 1. Statut de la climatisation

#### `GET /prepaid/ac-status`
Obtient le statut actuel de la climatisation.

**Réponse:**
```json
{
  "meta": {
    "code": 200,
    "message": "Success"
  },
  "data": {
    "ac_status": {
      "DisconnectRelay": true,
      "V": 220,
      "P": 1500,
      "I": 6.8,
      "PF": 0.85,
      "kWhImport": 12.5,
      "DeviceName": "AC_ROOM_101",
      "Time": "2024-01-15T10:30:00Z"
    }
  }
}
```

### 2. Contrôle ON/OFF

#### `POST /prepaid/toggle-status`
Active ou désactive la climatisation.

**Payload:**
```json
{
  "toggle": {
    "status": 1  // 1 = ON, 0 = OFF
  }
}
```

**Réponse:**
```json
{
  "meta": {
    "code": 200,
    "message": "Success"
  },
  "data": {
    "ac_toggle": {
      "Code": 0,
      "DisconnectRelay": false,
      "Message": "Execution succeeded"
    }
  }
}
```

### 3. Timer avec arrêt automatique

#### `POST /prepaid/toggle-status`
Programme un arrêt automatique de la climatisation.

**Payload:**
```json
{
  "toggle": {
    "timer": "2024-01-15T12:30:00.000Z",  // ISO timestamp
    "status": 1
  }
}
```

### 4. Solde et minutes restantes

#### `GET /prepaid/ac-balance`
Obtient le solde en minutes d'utilisation.

**Réponse:**
```json
{
  "meta": {
    "code": 200,
    "message": "Success"
  },
  "data": {
    "ac_data": {
      "balance": 145,  // Minutes restantes
      "remaining_balance_in_percentage": 68,
      "total_paid": 150.00,  // HKD dépensés
      "charge_unit": "per_minute",
      "billing_start_date": "2024-01-01T00:00:00Z",
      "billing_end_date": "2024-01-31T23:59:59Z"
    }
  }
}
```

### 5. Détails du cycle de facturation

#### `GET /prepaid/billing-cycle-details`
Informations détaillées sur la facturation et les prix.

**Réponse:**
```json
{
  "data": {
    "billing_cycle_details": [
      {
        "total_amount": 200.00,      // Montant total HKD
        "total_paid_amount": 8000,   // Minutes totales achetées
        "prepaid_balance": 145,      // Minutes restantes
        "total_usage": 7855         // Minutes utilisées
      }
    ]
  }
}
```

### 6. Cycles de facturation et tarification

#### `GET /prepaid/billing-cycles`
Structure tarifaire et cycles de facturation.

**Réponse:**
```json
{
  "data": {
    "billing_cycles": [
      {
        "status": "published",
        "pricing_scheme": {
          "charge_unit": "per_minute",
          "pricing_tiers": [
            {
              "price_per_kwh": 1.2,  // HKD par kWh
              "fixed_price": 0
            }
          ]
        }
      }
    ]
  }
}
```

### 7. Historique des top-ups

#### `GET /prepaid/topup-history`
Historique des recharges de compte.

**Réponse:**
```json
{
  "data": {
    "top_ups": [
      {
        "topup_data": {
          "id": "topup_123",
          "amount": 100.00,        // Montant HKD
          "topup_minute": 4000,    // Minutes ajoutées
          "status": "paid",
          "created_at": "2024-01-10T14:30:00Z",
          "billing_cycle_name": "January 2024"
        },
        "charge_unit": "per_minute"
      }
    ]
  }
}
```

### 8. Résumé de consommation électrique

#### `GET /dashboard/power-consumption-summary`
Statistiques de consommation quotidienne/hebdomadaire.

**Paramètres:**
- `period`: `"daily"` ou `"weekly"`
- `charge_type`: `"prepaid"`

**Réponse:**
```json
{
  "data": {
    "power_consumption_summary": {
      "daily": {
        "total_kwh": 12.5,
        "cost": 15.00,
        "usage_time_minutes": 480
      },
      "weekly": {
        "total_kwh": 75.2,
        "cost": 90.24,
        "usage_time_minutes": 2880
      }
    }
  }
}
```

---

## Exemples de requêtes/réponses

### Exemple 1: Démarrer la climatisation pour 2 heures

```javascript
// 1. Créer la date de fin (maintenant + 120 minutes)
const endTime = new Date(Date.now() + 120 * 60000).toISOString();

// 2. Envoyer la requête
const response = await fetch('/prepaid/toggle-status', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + authToken
  },
  body: JSON.stringify({
    toggle: {
      timer: endTime,
      status: 1
    }
  })
});

// 3. Traiter la réponse
const result = await response.json();
if (result.meta.code === 200) {
  console.log('AC programmée pour 2 heures');
}
```

### Exemple 2: Vérifier le solde disponible

```javascript
const response = await fetch('/prepaid/ac-balance', {
  headers: {
    'Authorization': 'Bearer ' + authToken
  }
});

const data = await response.json();
const minutesRestantes = data.data.ac_data.balance;
const heuresRestantes = Math.floor(minutesRestantes / 60);

console.log(`Temps restant: ${heuresRestantes}h ${minutesRestantes % 60}m`);
```

## Gestion des erreurs

### Codes d'erreur HTTP
- **200**: Succès
- **401**: Token expiré ou invalide
- **403**: Accès refusé
- **404**: Endpoint non trouvé
- **429**: Trop de requêtes
- **500**: Erreur serveur interne
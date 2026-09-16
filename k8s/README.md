# Facial.io — Kubernetes Manifests

## Files

| File | Purpose |
|---|---|
| `namespace.yaml` | Creates the `facialio` namespace |
| `configmap.yaml` | Non-sensitive env vars (NODE_ENV, PORT, URLs) |
| `secret.yaml` | Template for sensitive keys — fill before applying |
| `mongo-deployment.yaml` | MongoDB pod + PVC + ClusterIP service |
| `server-deployment.yaml` | NestJS backend (2 replicas) + ClusterIP service |
| `client-deployment.yaml` | React/nginx frontend (2 replicas) + ClusterIP service |
| `ingress.yaml` | nginx Ingress — routes facialio.app / api.facialio.app |
| `hpa.yaml` | Autoscales server from 2 to 5 replicas on CPU/memory |

## Prerequisites

```bash
# nginx ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# cert-manager (TLS certificates)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

## Apply Order

```bash
# 1. Namespace first
kubectl apply -f k8s/namespace.yaml

# 2. Fill in secret.yaml with real values, then apply
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml

# 3. Database
kubectl apply -f k8s/mongo-deployment.yaml

# 4. App
kubectl apply -f k8s/server-deployment.yaml
kubectl apply -f k8s/client-deployment.yaml

# 5. Routing + scaling
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Or apply everything at once (namespace must exist first):
kubectl apply -f k8s/
```

## Useful Commands

```bash
# Watch pods come up
kubectl get pods -n facialio -w

# Check logs
kubectl logs -n facialio deployment/facialio-server

# Check HPA status
kubectl get hpa -n facialio

# Check ingress
kubectl get ingress -n facialio
```

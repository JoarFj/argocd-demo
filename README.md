# Argo CD Python App Demo

This repository contains a simple Python Flask application, intended to be deployed via Argo CD on a local Kubernetes cluster using Kind (Kubernetes in Docker). It also includes a GitHub Actions CI/CD pipeline to automate image building and manifest updates.

## Project Structure

- `app.py`: The Python Flask application.
- `Dockerfile`: Defines how to build the Docker image for the Python application.
- `.dockerignore`: Specifies files to ignore when building the Docker image.
- `k8s/`: Contains the Kubernetes manifests for the Python application deployment and service.
- `argocd-app.yaml`: The Argo CD Application manifest that tells Argo CD how to deploy the Python application from this repository.
- `.github/workflows/ci.yml`: GitHub Actions workflow for building, pushing, and updating Kubernetes manifests.

## Local Setup with Kind and Argo CD

This guide will walk you through setting up a local Kubernetes cluster using Kind, installing Argo CD, and deploying the Python application.

### Prerequisites

-   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with WSL2 integration enabled if on Windows)
-   `kind` (Kubernetes in Docker)
-   `kubectl` (Kubernetes command-line tool)
-   `curl` (for downloading tools)

### 1. Install `kind` and `kubectl`

Open your WSL2 terminal (or Linux terminal) and run the following commands:

```bash
# Install kind
[ $(uname -m) = x86_64 ] && curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.23.0/kind-linux-amd64
[ $(uname -m) = aarch64 ] && curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.23.0/kind-linux-arm64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# Install kubectl
KUBECTL_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt)
curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/$(uname -m)/kubectl"
chmod +x ./kubectl
sudo mv ./kubectl /usr/local/bin/kubectl
```

### 2. Create a Kind Cluster

We need a Kind cluster configured to expose ports 80 and 443 for the Ingress controller.

First, create a file named `kind-config.yaml` with the following content:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
```

Then, create the Kind cluster using this configuration:

```bash
kind create cluster --config kind-config.yaml
```

### 3. Install Argo CD

Install Argo CD into your Kind cluster:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### 4. Install NGINX Ingress Controller

Install the NGINX Ingress controller for Kind. This is necessary to expose the Argo CD UI.

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
```

Wait for the Ingress controller to be ready:

```bash
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s
```

### 5. Expose Argo CD UI with Ingress

Create a file named `argocd-ingress.yaml` with the following content. This Ingress resource will expose the Argo CD UI on `https://localhost`.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server-ingress
  namespace: argocd
  annotations:
    nginx.ingress.kubernetes.io/ssl-passthrough: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
spec:
  ingressClassName: nginx
  rules:
  - http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: argocd-server
            port:
              name: https
```

Apply the Ingress resource:

```bash
kubectl apply -f argocd-ingress.yaml
```

### 6. Access Argo CD UI

Navigate to `https://localhost` in your web browser. You will encounter a certificate warning; you must bypass this warning to proceed.

To get the initial admin password:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

Use `admin` as the username and the retrieved password to log in.

### 7. Deploy the Python Application

Once logged into Argo CD, you can deploy the Python application by applying the `argocd-app.yaml` manifest. This tells Argo CD to monitor this Git repository and deploy the `k8s/` manifests.

```bash
kubectl apply -f argocd-app.yaml
```

Argo CD will now synchronize and deploy the Python application. You can observe its status in the Argo CD UI or using `kubectl`:

```bash
kubectl get deployments -n default
kubectl get services -n default
```

**Important Note on Argo CD Application Updates:**

Changes to the `argocd-app.yaml` file itself (e.g., renaming the application) are not automatically picked up by Argo CD's GitOps sync process because this file defines the Argo CD Application resource, not the application's Kubernetes manifests. If you modify `argocd-app.yaml`, you must manually apply the changes to your cluster:

```bash
kubectl apply -f argocd-app.yaml
```

If you rename the application (e.g., from `nginx-app` to `python-app`), you will also need to delete the old application resource from Argo CD:

```bash
kubectl delete application <old-app-name> -n argocd
```

---

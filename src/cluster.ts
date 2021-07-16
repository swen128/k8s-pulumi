import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

const provider = new gcp.Provider("provider", {project: 'kubernetes-309113'})
export const cluster = new gcp.container.Cluster("pulumi-trial", {
  location: 'us-central1-a',
  initialNodeCount: 1,
  removeDefaultNodePool: true,
}, {provider})

const nodePool = new gcp.container.NodePool(`primary-node-pool`, {
  cluster: cluster.name,
  initialNodeCount: 2,
  location: cluster.location,
  nodeConfig: {
    preemptible: true,
    machineType: "n1-standard-1",
    oauthScopes: [
      "https://www.googleapis.com/auth/compute",
      "https://www.googleapis.com/auth/devstorage.read_only",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring",
    ],
  },
  management: {
    autoRepair: true,
    autoUpgrade: true,
  },
}, {
  dependsOn: [cluster],
  provider,
});

// https://github.com/pulumi/kubernetes-guides/blob/master/orig/gcp/infrastructure/index.ts
//
// Manufacture a GKE-style Kubeconfig. Note that this is slightly "different" because of the way
// GKE requires gcloud to be in the picture for cluster authentication (rather than using the
// client cert/key directly).
function createKubeConfig(gkeCluster: gcp.container.Cluster): pulumi.Output<string> {
  return pulumi
    .all([gkeCluster.name, gkeCluster.endpoint, gkeCluster.masterAuth])
    .apply(([name, endpoint, auth]) => {
      const context = `${gcp.config.project}_${gcp.config.zone}_${name}`;
      return `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${auth.clusterCaCertificate}
    server: https://${endpoint}
  name: ${context}
contexts:
- context:
    cluster: ${context}
    user: ${context}
  name: ${context}
current-context: ${context}
kind: Config
preferences: {}
users:
- name: ${context}
  user:
    auth-provider:
      config:
        cmd-args: config config-helper --format=json
        cmd-path: gcloud
        expiry-key: '{.credential.token_expiry}'
        token-key: '{.credential.access_token}'
      name: gcp
`;
    });
}

export const kubeConfig = createKubeConfig(cluster)

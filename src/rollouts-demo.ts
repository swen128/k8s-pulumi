import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";

import {Rollout} from "../crds/nodejs/argoproj/v1alpha1";
import {kubeConfig} from "./cluster";

export {kubeConfig}

const provider = new k8s.Provider("provider", {kubeconfig: kubeConfig});


const labels = {app: 'bluegreen-demo'}
const imageName = 'argoproj/rollouts-demo:green'

const activeServiceName = "bluegreen-demo"
const previewServiceName = "bluegreen-preview"


const pb = new kx.PodBuilder({
  containers: [{
    name: "bluegreen-demo",
    image: imageName,
    ports: {http: 8080},
  }]
})

const namespace = new k8s.core.v1.Namespace("argo-rollouts", {
  metadata: {name: "argo-rollouts"},
}, {provider})
const rolloutsCrd = new k8s.kustomize.Directory("rolloutsCrd", {
  directory: "https://github.com/argoproj/argo-rollouts/tree/master/manifests/cluster-install",
}, {
  provider: new k8s.Provider("argo-rollouts", {
    kubeconfig: kubeConfig,
    namespace: namespace.metadata.name
  })
})

const rollout = new Rollout("hello-k8s", {
    metadata: {
      name: 'bluegreen-demo',
      labels
    },
    spec: {
      replicas: 3,
      revisionHistoryLimit: 1,
      selector: {matchLabels: labels},
      template: {
        metadata: {labels},
        spec: pb.podSpec,
      },
      strategy: {
        blueGreen: {
          autoPromotionEnabled: true,
          activeService: activeServiceName,
          previewService: previewServiceName,
        }
      },
    }
  },
  {provider, dependsOn: rolloutsCrd}
)


const serviceSpec: k8s.types.input.core.v1.ServiceSpec = {
  type: 'NodePort',
  selector: labels,
  ports: [{
    port: 80,
    targetPort: 'http',
    protocol: 'TCP',
    name: 'http',
  }],
}
const activeService = new k8s.core.v1.Service('bluegreen-demo', {
  metadata: {
    name: activeServiceName,
    labels,
  },
  spec: serviceSpec
}, {provider})
const previewService = new k8s.core.v1.Service('bluegreen-demo-preview', {
  metadata: {
    name: previewServiceName,
    labels,
  },
  spec: serviceSpec
}, {provider})

// const ingress = new k8s.networking.v1beta1.Ingress('bluegreen-demo', {
//   spec: {
//     rules: [
//       hostToServiceMapping('blue-green.example.com', activeServiceName),
//       hostToServiceMapping('blue-green-preview.example.com', previewServiceName),
//     ]
//   }
// }, {provider})
//
// function hostToServiceMapping(host: string, serviceName: string): k8s.types.input.networking.v1beta1.IngressRule {
//   return {
//     host,
//     http: {
//       paths: [{
//         path: '/*',
//         backend: {
//           serviceName,
//           servicePort: 80,
//         }
//       }]
//     }
//   }
// }

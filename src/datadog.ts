import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"

import {kubeConfig} from "./cluster";

export {kubeConfig}

const config = new pulumi.Config()
const provider = new k8s.Provider("provider", {kubeconfig: kubeConfig});

export const datadog = new k8s.helm.v3.Chart("datadog", {
  chart: "datadog",
  fetchOpts: {
    repo: "https://charts.helm.sh/stable/",
  },
  values: {
    datadog: {
      apiKey: config.requireSecret("datadog_api_key"),
      site: "datadoghq.com",
    },
  }
}, {provider})

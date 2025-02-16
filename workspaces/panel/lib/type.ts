export type Namespace = {
  metadata: {
    name: string;
  }
}

export type Pod = {
  status: {
    phase: string;
  },
  metadata: {
    name: string;
  }
}

export type Ingress = {
  metadata: {
    name: string;
  },
  spec: {
    rules: {
      host: string;
    }[]
  }
}

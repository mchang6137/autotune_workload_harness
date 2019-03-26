const { Container, allow} = require('@quilt/quilt');
const { publicInternet } = require('@quilt/quilt');

const workload_lb = 'mchang6137/hotrodworkloadlb';
const workload_pod = 'mchang6137/hotrodworkload';

function getHostname(c) {
  return c.getHostname();
}

function WorkloadGen(num_workers) {
    this.cluster = [];
    this.cluster.push(new Container('workload_lb', workload_lb));
    const experiment_types = ['workload_mapper', 'workload_index', 'workload_dispatch'];

    // Set up loadbalancer
    const mapper_baseport = 5000;
    const dispatch_baseport = 6000;
    const index_baseport = 7000;

    this.cluster[0].setEnv("WORKLOAD_INDEX_PORT", index_baseport.toString());
    this.cluster[0].setEnv("WORKLOAD_MAPPER_PORT", mapper_baseport.toString());
    this.cluster[0].setEnv("WORKLOAD_DISPATCH_PORT", dispatch_baseport.toString());
    allow(publicInternet, this.cluster, 80);

    // Set up workload mappers
    mapper_worker = [];
    for (i = 0; i < num_workers; i++){
	mapper_worker.push(new Container("workload_mapper", workload_pod));
	mapper_worker[i].setEnv("WORKLOAD_PORT", (mapper_baseport + i).toString());
	allow(this.cluster, mapper_worker[i], mapper_baseport + i);
	allow(mapper_worker[i], this.cluster, 80);
    }
    const mapper_hostnames = mapper_worker.map(getHostname).join(',');
    this.cluster[0].setEnv("WORKLOAD_MAPPER_HOSTNAME", mapper_hostnames);

    // Set up workload dispatch
    dispatch_worker = [];
    for (i = 0; i < num_workers; i++){
        dispatch_worker.push(new Container("workload_dispatch", workload_pod));
        dispatch_worker[i].setEnv("WORKLOAD_PORT", (dispatch_baseport + i).toString());
        allow(this.cluster, dispatch_worker[i], dispatch_baseport + i);
        allow(dispatch_worker[i], this.cluster, 80);
    }
    const dispatch_hostnames = dispatch_worker.map(getHostname).join(',');
    this.cluster[0].setEnv("WORKLOAD_DISPATCH_HOSTNAME", dispatch_hostnames);

    //Set up workload indexers
    index_worker = [];
    for (i = 0; i < num_workers; i++){
        index_worker.push(new Container("workload_index", workload_pod));
        index_worker[i].setEnv("WORKLOAD_PORT", (index_baseport + i).toString());
        allow(this.cluster, index_worker[i], index_baseport + i);
        allow(index_worker[i], this.cluster, 80);
    }
    const index_hostnames = index_worker.map(getHostname).join(',');
    this.cluster[0].setEnv("WORKLOAD_INDEX_HOSTNAME", index_hostnames);
    
    this.cluster = this.cluster.concat(index_worker);
    this.cluster = this.cluster.concat(dispatch_worker);
    this.cluster = this.cluster.concat(mapper_worker);
}

WorkloadGen.prototype.deploy = function deploy(deployment) {
    deployment.deploy(this.cluster);
};

WorkloadGen.prototype.allowFrom = function allowFrom(from, p) {
    allow(from, this.cluster, p);
};

module.exports = WorkloadGen;

const { Container, allow} = require('@quilt/quilt');
const { publicInternet } = require('@quilt/quilt');

const workload_lb = 'mchang6137/workloadlb';
const workload_pod = 'mchang6137/workloadmean';

function getHostname(c) {
  return c.getHostname();
}
      
function WorkloadGen(num_workers) {
    this.cluster = [];
    this.cluster.push(new Container('workloadlb', workload_lb));
    const baseport = 5000;
    this.cluster.forEach((m) => {
	m.setEnv("WORKLOAD_PORT", baseport.toString());
    });

    allow(publicInternet, this.cluster, 80);

    // Set Port numbers
    worker_cluster = []
    for (i = 0; i < num_workers; i++){
	worker_cluster.push(new Container('workload', workload_pod));
	instance = worker_cluster[i];
	worker_cluster[i].setEnv("WORKLOAD_PORT", (baseport + i).toString());
	allow(this.cluster, worker_cluster[i], baseport + i);
	allow(worker_cluster[i], this.cluster, 80);
    }
    
    const hostnames = worker_cluster.map(getHostname).join(',');
    this.cluster[0].setEnv("WORKLOAD_HOSTNAME", hostnames);
    this.cluster = this.cluster.concat(worker_cluster);

}

WorkloadGen.prototype.deploy = function deploy(deployment) {
    deployment.deploy(this.cluster);
};

WorkloadGen.prototype.allowFrom = function allowFrom(from, p) {
    allow(from, this.cluster, p);
};

module.exports = WorkloadGen;




    

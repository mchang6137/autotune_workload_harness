const { Container, allow} = require('@quilt/quilt');
const { publicInternet } = require('@quilt/quilt');

const workload_lb = 'mchang6137/aptworkloadlb';
const workload_pod = 'mchang6137/aptworkload';

function getHostname(c) {
  return c.getHostname();
}

function WorkloadGen(num_workers) {
    this.cluster = [];
    this.cluster.push(new Container('workload_lb', workload_lb));
    const experiment_types = ['postgresql_get',
			      'postgresql_put',
			      'mysql_get',
			      'mysql_put',
			      'welcome',
			      'elastic']

    // Set up loadbalancer
    const postgresql_get_baseport = 5000;
    const postgresql_put_baseport = 6000;
    const mysql_get_baseport = 7000;
    const mysql_put_baseport = 8000;
    const welcome_baseport = 9000;
    const elastic_baseport = 9500;

    this.cluster[0].setEnv("POSTGRESQL_GET_PORT", postgresql_get_baseport.toString());
    this.cluster[0].setEnv("POSTGRESQL_PUT_PORT", postgresql_put_baseport.toString());
    this.cluster[0].setEnv("MYSQL_GET_PORT", mysql_get_baseport.toString());
    this.cluster[0].setEnv("MYSQL_PUT_PORT", mysql_put_baseport.toString());
    this.cluster[0].setEnv("WELCOME_PORT", welcome_baseport.toString());
    this.cluster[0].setEnv("ELASTIC_PORT", elastic_baseport.toString());
    allow(publicInternet, this.cluster, 80);

    // Set up workload mappers
    postgresql_get_worker = [];
    for (i = 0; i < num_workers; i++){
	postgresql_get_worker.push(new Container("workload_postgresql_get", workload_pod));
	postgresql_get_worker[i].setEnv("WORKLOAD_PORT", (postgresql_get_baseport + i).toString());
	allow(this.cluster, postgresql_get_worker[i], postgresql_get_baseport + i);
	allow(postgresql_get_worker[i], this.cluster, 80);
    }
    const postgresql_get_hostnames = postgresql_get_worker.map(getHostname).join(',');
    this.cluster[0].setEnv("POSTGRESQL_GET_HOSTNAME", postgresql_get_hostnames);

    // Set up workload dispatch
    postgresql_put_worker = [];
    for (i = 0; i < num_workers; i++){
        postgresql_put_worker.push(new Container("workload_postgresql_put", workload_pod));
        postgresql_put_worker[i].setEnv("WORKLOAD_PORT", (postgresql_put_baseport + i).toString());
        allow(this.cluster, postgresql_put_worker[i], postgresql_put_baseport + i);
        allow(postgresql_put_worker[i], this.cluster, 80);
    }
    const postgresql_put_hostnames = postgresql_put_worker.map(getHostname).join(',');
    this.cluster[0].setEnv("POSTGRESQL_PUT_HOSTNAME", postgresql_put_hostnames);

    //Set up workload indexers
    mysql_get_worker = [];
    for (i = 0; i < num_workers; i++){
        mysql_get_worker.push(new Container("workload_mysql_get", workload_pod));
        mysql_get_worker[i].setEnv("WORKLOAD_PORT", (mysql_get_baseport + i).toString());
        allow(this.cluster, mysql_get_worker[i], mysql_get_baseport + i);
        allow(mysql_get_worker[i], this.cluster, 80);
    }
    const mysql_get_hostnames = mysql_get_worker.map(getHostname).join(',');
    this.cluster[0].setEnv("MYSQL_GET_HOSTNAME", mysql_get_hostnames);

    welcome_worker = [];
    for (i = 0; i < num_workers; i++){
        welcome_worker.push(new Container("workload_welcome", workload_pod));
        welcome_worker[i].setEnv("WORKLOAD_PORT", (welcome_baseport + i).toString());
        allow(this.cluster, welcome_worker[i], welcome_baseport + i);
        allow(welcome_worker[i], this.cluster, 80);
    }
    const welcome_hostnames = welcome_worker.map(getHostname).join(',');
    this.cluster[0].setEnv("WELCOME_HOSTNAME", welcome_hostnames);

    // Set up workload dispatch
    elastic_worker = [];
    for (i = 0; i < num_workers; i++){
        elastic_worker.push(new Container("workload_elastic", workload_pod));
        elastic_worker[i].setEnv("WORKLOAD_PORT", (elastic_baseport + i).toString());
        allow(this.cluster, elastic_worker[i], elastic_baseport + i);
        allow(elastic_worker[i], this.cluster, 80);
    }
    const elastic_hostnames = elastic_worker.map(getHostname).join(',');
    this.cluster[0].setEnv("ELASTIC_HOSTNAME", elastic_hostnames);

    //Set up workload indexers
    mysql_put_worker = [];
    for (i = 0; i < num_workers; i++){
        mysql_put_worker.push(new Container("workload_mysql_put", workload_pod));
        mysql_put_worker[i].setEnv("WORKLOAD_PORT", (mysql_put_baseport + i).toString());
        allow(this.cluster, mysql_put_worker[i], mysql_put_baseport + i);
        allow(mysql_put_worker[i], this.cluster, 80);
    }
    const mysql_put_hostnames = mysql_put_worker.map(getHostname).join(',');
    this.cluster[0].setEnv("MYSQL_PUT_HOSTNAME", mysql_put_hostnames);

    this.cluster = this.cluster.concat(mysql_get_worker);
    this.cluster = this.cluster.concat(mysql_put_worker);
    this.cluster = this.cluster.concat(postgresql_put_worker);
    this.cluster = this.cluster.concat(postgresql_get_worker);
    this.cluster = this.cluster.concat(elastic_worker);
    this.cluster = this.cluster.concat(welcome_worker);
}

WorkloadGen.prototype.deploy = function deploy(deployment) {
    deployment.deploy(this.cluster);
};

WorkloadGen.prototype.allowFrom = function allowFrom(from, p) {
    allow(from, this.cluster, p);
};

module.exports = WorkloadGen;

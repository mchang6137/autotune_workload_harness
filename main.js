const quilt = require('@quilt/quilt');
const machineFactory = require('./machines');
const hotrod = require('./hotrod');
const placement = require('./placements');
const WorkloadGen = require('./workload.js');

// const namespace = "hotrod-app-" + Math.floor(Math.random() * 10000).toString();
const namespace = "hotrod-app-michael"
const deployment = quilt.createDeployment({namespace: namespace, adminACL: ['0.0.0.0/0']});

var machines = new machineFactory(7);
// var machines = new machineFactory(21);

hotrodApp = new hotrod();
new placement(hotrodApp, machines.getSizes()).three_per();

const workload_count = 1;
const workload = new WorkloadGen(workload_count);
hotrodApp.ingress.allowFrom(workload.cluster, 80);

deployment.deploy(machines);
deployment.deploy(hotrodApp);
deployment.deploy(workload);

const quilt = require('@quilt/quilt');
const nodeServer = require('./nodeServer');
const WorkloadGen = require('./workload.js');

const deployment = quilt.createDeployment({namespace: "mchang_apartment_app", adminACL: ['0.0.0.0/0']});

var machine0 = new quilt.Machine({
    provider: "Amazon",
    size: "m4.large",
    region: 'us-west-1',
    sshKeys: quilt.githubKeys('mchang6137'),
});

deployment.deploy(machine0.asMaster());

const base_app_disksize = 40;
application_machine_count = 7;
for(i = 0; i < application_machine_count; i++){
    var machine = new quilt.Machine({
	provider: "Amazon",
	size: "m4.large",
	sshKeys: quilt.githubKeys('mchang6137'),
	region: 'us-west-1',
	diskSize: base_app_disksize+i,
    });

    deployment.deploy(machine.asWorker());
}


const workload_count = 2;
const workload = new WorkloadGen(workload_count);

machine_list = [];
const baseDiskSize = 20;
for (i=0; i < workload_count; i++) {
    const workloadMachine = new quilt.Machine({
        provider: 'Amazon',
        size: 'm4.large',
        diskSize: baseDiskSize+i,
        region: 'us-west-1',
	sshKeys: quilt.githubKeys('mchang6137'),
    });
    deployment.deploy(workloadMachine.asWorker());
    machine_list.push(workloadMachine);
}

workload.cluster[0].placeOn({diskSize: 20});
for(i=0; i < workload_count; i++) {
    workload.cluster[i+1].placeOn({diskSize: 20+i});
    workload.cluster[i+ 1 + workload_count].placeOn({diskSize: 20+i});
    workload.cluster[i + 1 + workload_count*2].placeOn({diskSize: 20+i});
}

var countNode = 3;
const nodeRepository = 'tsaianson/node-apt-app-2';
const apartmentApp = new nodeServer(countNode, nodeRepository);

apartmentApp.proxy.allowFrom(workload.cluster, 80);
//apartmentApp.proxy.allowFrom(apartmentApp.mysql, 80);
apartmentApp.machPlacements([40,41,42,43,44,45,46]);
deployment.deploy(apartmentApp);
deployment.deploy(workload);

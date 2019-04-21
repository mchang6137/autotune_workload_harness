from flask import Flask, request
from requests_futures.sessions import FuturesSession
from clear_entries import *
import subprocess
import json
import os
import time
import sys

app = Flask(__name__)

# Port and hostname of the port of the workload generation pods
workload_port = {'index': int(os.environ['WORKLOAD_INDEX_PORT']),
                 'dispatch': int(os.environ['WORKLOAD_DISPATCH_PORT']),
                 'mapper': int(os.environ['WORKLOAD_MAPPER_PORT'])}

workload_gen_hostnames = {'index': os.environ['WORKLOAD_INDEX_HOSTNAME'], 
                          'dispatch':  os.environ['WORKLOAD_DISPATCH_HOSTNAME'],
                          'mapper': os.environ['WORKLOAD_MAPPER_HOSTNAME']}

# Return an in-order list of hostnames
def parse_hostnames(job_type):
    assert job_type in workload_gen_hostnames.keys()
    hostname_list = workload_gen_hostnames[job_type].split(',')
    return hostname_list
    
# Asyncrnously run command
@app.route('/startab')
def run_experiment():
    # In this case, workload pods is the number of replica pods for an individual endpoint
    # Assumes the same number of replicas for each endpoint.
    workload_pods = int(request.args.get('w', default=1))
    num_dispatch = int(request.args.get('num_dispatch', default=500))
    num_index = int(request.args.get('num_index', default=1000))
    concurrency_dispatch = int(request.args.get('concurrency_dispatch', default=150))
    concurrency_mapper = int(request.args.get('concurrency_mapper', default=150))
    concurrency_index = int(request.args.get('concurrency_index', default=150))
    frontend_hostname = request.args.get('frontend_hostname', default='hotrod-ingress.q')
    frontend_port = request.args.get('frontend_port', default=80)
    
    session = FuturesSession()

    experiment_types = ['index', 'mapper', 'dispatch']
    experiment_concurrency = {'index': concurrency_index,
                              'mapper': concurrency_mapper,
                              'dispatch': concurrency_dispatch
                              }
    futures = []
    for experiment in experiment_types:
        hostname_list = parse_hostnames(experiment)

        for worker_id in range(workload_pods):
            complete_hostname = 'http://' + workload_gen_hostnames[experiment] + ':' \
                                str(workload_port[experiment]) + '/startab'

            futures.append(session.get(complete_hostname, params={'num_dispatch': num_dispatch,
                                                                  'num_index': num_index,
                                                                  'c': experiment_concurrency[experiment],
                                                                  'hostname': frontend_hostname,
                                                                  'port': frontend_port,
                                                                  'request_type': experiment
            }))

    for future in futures:
        print(future.result())
    sys.stdout.flush()
    
    return 'Experiment started!'

# Collect and clear results
@app.route('/collectresults')
def collect_results():
    workload_pods = int(request.args.get('w', default=1))
    
    total_attempt = 25
    experiment_types = ['index', 'mapper', 'dispatch']
    type_results = {'index': {},
                    'mapper': {},
                    'dispatch': {}}

    for experiment in experiment_types:
        hostname_list = parse_hostnames(experiment)
        is_collected = False
        for attempt in range(total_attempt):
            session = FuturesSession()
            futures = []
            
            for worker_id in range(workload_pods):
                complete_hostname =	'http://' + workload_gen_hostnames[experiment] + ':' \
                                str(workload_port[experiment]) + '/collectresults'
                futures.append(session.get(complete_hostname))

            results = []
            for future in futures:
                try:
                    result = future.result().json()
                    results.append(result)
                    is_collected = True
                except Exception as e:
                    time.sleep(30)
                    break

            if is_collected is False:
                continue
                
            # Average over all the worklaod generators
            result_avg = {}
            for result in results:
                for k in result:
                    if k in result_avg:
                        result_avg[k] += float(result[k])/workload_pods
                    else:
                        result_avg[k] = float(result[k])/workload_pods

        type_results[experiment] = result_avg
        if is_collected is False:
            return 'Failed', 400

    return json.dumps(type_results), 200

@app.route('/clearentries')
def clear_results():
    workload_pods = int(request.args.get('w', default=1))
    session = FuturesSession()
    futures = []
    experiment_types = ['index', 'mapper', 'dispatch']
    for experiment in experiment_types:
        hostname_list = parse_hostnames(experiment)
        for worker_id in range(workload_pods):
            complete_hostname =	'http://' + workload_gen_hostnames[experiment] + ':' \
                                str(workload_port[experiment]) + '/cleanfiles'
            futures.append(session.get(complete_hostname))

    for future in futures:
        result = future.result()
    
    return 'success',200
    
def execute_parse_results():
    rps_cmd = 'cat /app/output.txt | grep \'Requests per second\' | awk {{\'print $4\'}}'
    latency90_cmd = 'cat /app/output.txt | grep \'90%\' | awk {\'print $2\'}'
    latency50_cmd = 'cat /app/output.txt | grep \'50%\' | awk {\'print $2\'}'
    latency99_cmd = 'cat /app/output.txt | grep \'99%\' | awk {\'print $2\'}'
    latency100_cmd = 'cat /app/output.txt | grep \'Time per request\' | awk \'NR==1{{print $4}}\''

    results = {}

    proc_rps = subprocess.Popen(rps_cmd, shell=True, stdout=subprocess.PIPE)
    proc_latency90 = subprocess.Popen(latency90_cmd, shell=True, stdout=subprocess.PIPE)
    proc_latency50 = subprocess.Popen(latency50_cmd, shell=True, stdout=subprocess.PIPE)
    proc_latency99 = subprocess.Popen(latency99_cmd, shell=True, stdout=subprocess.PIPE)
    proc_latency100 = subprocess.Popen(latency100_cmd, shell=True, stdout=subprocess.PIPE)

    result_rps = proc_rps.stdout.read().decode()
    result_latency90 = proc_latency90.stdout.read().decode()
    result_latency50 = proc_latency50.stdout.read().decode()
    result_latency99 = proc_latency99.stdout.read().decode()
    result_latency100 = proc_latency100.stdout.read().decode()

    try:
        results['rps'] = float(result_rps.strip('\n'))
        results['latency_99'] = float(result_latency99.strip('\n'))
        results['latency_90'] = float(result_latency90.strip('\n'))
        results['latency_50'] = float(result_latency50.strip('\n'))
        results['latency'] = float(result_latency100.strip('\n'))
    except:
        if len(results.keys()) == 0:
            return {}
    
    return results

if __name__ == '__main__':
    app.run(
        host=app.config.get('HOST', '0.0.0.0'),
        port=app.config.get('PORT', 80)
    )

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
workload_port = {'postgresql_get': int(os.environ['POSTGRESQL_GET_PORT']),
                 'postgresql_put': int(os.environ['POSTGRESQL_PUT_PORT']),
                 'mysql_get': int(os.environ['MYSQL_GET_PORT']),
                 'mysql_put': int(os.environ['MYSQL_PUT_PORT']),
                 'welcome': int(os.environ['WELCOME_PORT']),
                 'elastic': int(os.environ['ELASTIC_PORT'])
}

workload_gen_hostnames = {'postgresql_get': os.environ['POSTGRESQL_GET_HOSTNAME'], 
                          'postgresql_put':  os.environ['POSTGRESQL_PUT_HOSTNAME'],
                          'mysql_get': os.environ['MYSQL_GET_HOSTNAME'],
                          'mysql_put': os.environ['MYSQL_PUT_HOSTNAME'],
                          'welcome': os.environ['WELCOME_HOSTNAME'],
                          'elastic': os.environ['ELASTIC_HOSTNAME']
}

# Return an in-order list of hostnames
def parse_hostnames(job_type):
    assert job_type in workload_gen_hostnames.keys()
    hostname_list = workload_gen_hostnames[job_type].split(',')
    return hostname_list

@app.route('/init')
def init_experiment():
    n = int(request.args.get('n'))
    c = int(request.args.get('c'))
    hostname = request.args.get('hostname', default='haproxy.q')

    psql_init_cmd = 'ab -p post.json -T application/json -n {} -c {} -s 9999 -e results_file http://{}:80/app/psql/users/'.format(n, c, hostname)
    pn = []
    pn.append(subprocess.Popen(psql_init_cmd, shell=True))
    mysql_init_cmd = 'ab -p post.json -T application/json -n {} -c {} -s 9999 -e results_file http://{}:80/app/mysql/users/'.format(n, c, hostname)
    pn.append(subprocess.Popen(mysql_init_cmd, shell=True))
    exit_codes = [p.wait() for p in pn]
    print(exit_codes)
    time.sleep(5)
    return 'database initiated'

@app.route('/delete')
def delete_experiment():
    apt_app_public_ip = request.args.get('hostname', default='haproxy.q')

    pn = []
    curl1 = 'curl -X "DELETE" http://{}:80/app/mysql/users'.format(apt_app_public_ip)
    pn.append(subprocess.Popen(curl1, shell=True))
    curl2 = 'curl -X "DELETE" http://{}:80/app/psql/users'.format(apt_app_public_ip)
    pn.append(subprocess.Popen(curl2, shell=True))
    curl3 = 'curl http://{}:80/app/elastic/reset'.format(apt_app_public_ip)
    pn.append(subprocess.Popen(curl3, shell=True))

    exit_codes = [p.wait() for p in pn]
    print(exit_codes)
    time.sleep(5)
    return 'database cleared'
    
# Asyncrnously run command
@app.route('/startab')
def run_experiment():
    # In this case, workload pods is the number of replica pods for an individual endpoint
    # Assumes the same number of replicas for each endpoint.
    workload_pods = int(request.args.get('w', default=1))

    num_postgresql_get = int(request.args.get('num_postgresql_get'))
    con_postgresql_get = int(request.args.get('con_postgresql_get'))
    
    num_postgresql_put = int(request.args.get('num_postgresql_put'))
    con_postgresql_put = int(request.args.get('con_postgresql_put'))
    
    num_mysql_get = int(request.args.get('num_mysql_get'))
    con_mysql_get = int(request.args.get('con_mysql_get'))

    num_mysql_put = int(request.args.get('num_mysql_put'))
    con_mysql_put = int(request.args.get('con_mysql_put'))

    num_welcome = int(request.args.get('num_welcome'))
    con_welcome = int(request.args.get('con_welcome'))

    num_elastic = int(request.args.get('num_elastic'))
    con_elastic = int(request.args.get('con_elastic'))

    # NOTE MICHAEL: CHANGE DEFAULT HOSTNAME
    frontend_hostname = request.args.get('frontend_hostname', default='haproxy.q')
    frontend_port = request.args.get('frontend_port', default=80)
    
    session = FuturesSession()

    experiment_types = ['postgresql_get', 'postgresql_put', 'mysql_get', 'mysql_put', 'welcome', 'elastic']
    experiment_concurrency = {'postgresql_get': con_postgresql_get,
                              'postgresql_put': con_postgresql_put,
                              'mysql_get': con_mysql_get,
                              'mysql_put': con_mysql_put,
                              'welcome': con_welcome,
                              'elastic': con_elastic
    }
    
    experiment_num = {'postgresql_get': num_postgresql_get,
                      'postgresql_put': num_postgresql_put,
                      'mysql_get': num_mysql_get,
                      'mysql_put': num_mysql_put,
                      'welcome': num_welcome,
                      'elastic': num_elastic
    }
    
    futures = []
    for experiment in experiment_types:
        hostname_list = parse_hostnames(experiment)

        for worker_id in range(workload_pods):
            port = workload_port[experiment] + worker_id

            complete_hostname = 'http://' + hostname_list[worker_id] + ':' + str(port) + '/startab'
            futures.append(session.get(complete_hostname, params={'n': experiment_num[experiment],
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
    experiment_types = [ 'postgresql_get', 'postgresql_put', 'mysql_get', 'mysql_put', 'welcome', 'elastic']
    type_results = {'postgresql_get': {},
                    'postgresql_put': {},
                    'mysql_get': {},
                    'mysql_put': {},
                    'welcome': {},
                    'elastic': {}
    }

    for experiment in experiment_types:
        hostname_list = parse_hostnames(experiment)
        is_collected = False
        for attempt in range(total_attempt):
            session = FuturesSession()
            futures = []
            
            for worker_id in range(workload_pods):
                port = workload_port[experiment] + worker_id
                complete_hostname = 'http://' + hostname_list[worker_id] + ':' + str(port) + '/collectresults'
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
    experiment_types = ['postgresql_get', 'postgresql_put', 'mysql_get', 'mysql_put', 'welcome', 'elastic']
    for experiment in experiment_types:
        hostname_list = parse_hostnames(experiment)
        for worker_id in range(workload_pods):
            port = workload_port[experiment] + worker_id
            complete_hostname = 'http://' + hostname_list[worker_id] + ':' + str(port) + '/cleanfiles'
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

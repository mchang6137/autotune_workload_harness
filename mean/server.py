from flask import Flask, request
from clear_entries import *
import pandas as pd
import subprocess
import json

app = Flask(__name__)

# Asyncrnously run command
@app.route('/startab')
def run_experiment():
    num_requests = int(request.args.get('n', default=350))
    concurrency = int(request.args.get('c', default=150))
    hostname = request.args.get('hostname')
    port = int(request.args.get('port'))

    post_cmd = 'ab -p post -T text/plain -n {} -c {} -s 200 -q \
    -e results_file http://{}/api/todos > /app/output.txt'.format(num_requests, concurrency, hostname)
    subprocess.Popen(post_cmd, shell=True)
    return 'Experiment started!'

# Collect and clear results
@app.route('/collectresults')
def collect_results():
    results = execute_parse_results()
    if len(results.keys()) == 0:
        return 'Failed'
    else:
        results = execute_parse_results()
    return json.dumps(results)

@app.route('/clearentries')
def clear_results():
    hostname = request.args.get('hostname')
    deleted_successfully = delete_final(hostname)
    if deleted_successfully:
        return 'success'
    else:
        print('Still some remaining entries after 100 seconds of waiting')
        return 'fail'
    
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
        results['latency99'] = float(result_latency99.strip('\n'))
        results['latency90'] = float(result_latency90.strip('\n'))
        results['latency50'] = float(result_latency50.strip('\n'))
        results['latency100'] = float(result_latency100.strip('\n'))
    except:
        if len(results.keys()) == 0:
            return {}
    
    return results

if __name__ == '__main__':
    app.run(
        host=app.config.get('HOST', '0.0.0.0'),
        port=app.config.get('PORT', 5000)
    )

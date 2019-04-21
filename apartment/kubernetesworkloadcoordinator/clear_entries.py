import argparse
import requests
import json
import time

REST_URL = '/api/todos'

def delete_posts(website_ip, all_ids):
    url = 'http://' + website_ip + REST_URL + '/'
    for ids in all_ids:
        requests.delete(url + ids)
    return 1

def GET_from_website(website_ip):
    url = 'http://' + website_ip + REST_URL
    r = requests.get(url).json()
    all_request_ids = []
    for request in r:
        all_request_ids.append(request['_id'])
    return all_request_ids


def clear_all_entries(website_ip):
    all_ids = GET_from_website(website_ip)
    fin = delete_posts(website_ip, all_ids)
    return fin

def delete_final(website_ip):
    fin = clear_all_entries(website_ip)
    
    recent = 0
    counter = 0
    while counter < 10:
        all_ids = GET_from_website(website_ip)
        if len(all_ids) == 0:
            print('All entries deleted')
            return 1
        else:
            time.sleep(10)

    return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("website_ip")
    args = parser.parse_args()

    print('Do testing')

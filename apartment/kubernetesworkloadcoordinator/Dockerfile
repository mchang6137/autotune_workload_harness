FROM ubuntu:16.04
MAINTAINER UCB Netsys

RUN apt-get update -y && \
    apt-get install -y python3-pip curl && \
    apt-get install -y apache2-utils

RUN pip3 install flask requests requests-futures

COPY server.py app/server.py
COPY clear_entries.py app/clear_entries.py
WORKDIR app

ENTRYPOINT [ "python3" ]

CMD [ "server.py" ]

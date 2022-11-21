import { register, Counter, Pushgateway } from 'prom-client';
import express from 'express';

const gateway = new Pushgateway('http://127.0.0.1:9091');

const app = express();

class BlockchairClient {
    constructor() { }
    async func1() {
        throw new Error()
    }
    async func2() {
        return 'func 2'
    }
}

class SolanaClient {
    constructor() { }
    async func3() {
        throw new Error()
    }
    async sum(a: number, b: number) {
        const total = a + b
        return `Total: ${total}`
    }
}

const counter = new Counter({
    name: 'request_counter',
    help: 'metric_help',
    labelNames: ['type', 'client', 'function'] as const,
});


function clientMonitor<T extends object>(client: T): T {
    return new Proxy(client, {
        get: (obj, prop) => {
            counter.inc({ type: 'access', client: obj.constructor.name, function: prop.toString() });
            //@ts-ignore
            const run = (...args) => {
                //@ts-ignore
                return obj[prop](...args).catch(_ => {
                    counter.inc({ type: 'error', client: obj.constructor.name, function: prop.toString() })
                });
            }
            return run;
        }
    })
}



const clientProxy = clientMonitor(new BlockchairClient())
const solanaClientProxy = clientMonitor(new SolanaClient())

async function main() {
    await clientProxy.func1()
    await clientProxy.func1()
    await clientProxy.func1()
    await clientProxy.func2()
    await clientProxy.func2()
    await solanaClientProxy.func3() //error
    await solanaClientProxy.func3() //error
    await solanaClientProxy.sum(1, 3)
    await solanaClientProxy.sum(1, 1)
    await solanaClientProxy.sum(2, 5)

    setInterval(() => {
        gateway.pushAdd({ jobName: 'request_counter' })
            .then(() => {
                /* ... */
            })
            .catch(err => {
                /* ... */
                console.error(err)
            });
    }, 1000)
    app.get('/metrics', async (_req, res) => res.send(await register.metrics()))
    app.get('/error', async (_req, res) => res.send(await solanaClientProxy.func3()))
    app.get('/access', async (_req, res) => res.send(await clientProxy.func2()))


    const port = 8888;
    app.listen(port, () => {
        console.log(`Example app listening on port ${port}`)
    })
}


main()




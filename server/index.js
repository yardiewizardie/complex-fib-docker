const keys = require('./keys');

// express app setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// postgres client set up

const { Pool } = require('pg');

const pgClient = new Pool({
	user: keys.pgUser,
	host: keys.pgHost,
	database: keys.pgDatabase,
	password: keys.pgPassword,
	port: keys.pgPort
});

pgClient.on('error', () => console.log('Lost Postgre Connection'));

pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)').catch((error) => console.log(error));

// redis client set up
const redis = require('redis');
const redisClient = redis.createClient({
	host: keys.redisHost,
	port: keys.redisPort,
	retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

// express route handlers

app.get('/', (req, res) => {
	res.send('yo');
});

app.get('/values/all', async (req, res) => {
	const values = await pgClient.query('SELECT * from values');
	res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
	redisClient.hgetall('values', (err, values) => {
		res.send(values);
	});
});

app.post('/values', async (req, res) => {
	const index = req.body.index;
	if (parseInt(index) > 40) res.status(422).send('Index too high');

	redisClient.hset('values', index, 'Nothing yet');
	redisPublisher.publish('insert', index);
	pgClient.query('INSERT INTO values(number) VALUES($1)', [ index ]);

	res.send({ working: true });
});

app.listen(5000, (err) => {
	console.log('server up');
});

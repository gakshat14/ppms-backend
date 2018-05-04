import express from 'express';
import path from 'path';
import { queryRouter } from './router/queryRouter';
import socketIo from 'socket.io'
const app = express();
import { Moment } from 'moment';
import { EventEmitter } from 'events';
import { startProcess } from './blink';

export const emitLocationData = new EventEmitter();

app.use('/ppms', queryRouter);

app.get('/health', (req, res) => {
    res.sendFile(path.join(__dirname, "src", "public.html"));
});

const server = app.listen(3000, "0.0.0.0", () => {
    console.log("App is listenng on 3000");
});

startProcess();

const io = socketIo(server);

io.on("connection", socket => {
    console.log("client connected");

    socket.on("Disconnect", () => {
        console.log("Client disconnected");
    });

    emitLocationData.on("valueChanged", (data) => {
        socket.emit("lol", {data});
    })
    
});



export default server;

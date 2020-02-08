import express from "express";
import path from "path";
import socketIo from "socket.io";
import { Moment } from "moment";
import { EventEmitter } from "events";
import { startProcess } from "./blink";

interface IUsedSpace {
    carNumber: string;
    location: string;
    timestamp: Moment;
}

interface IWholeObject {
    free_space: string[];
    used_space: IUsedSpace[];
}

let requestedCarNumber: string = "";
let assignedLocation: string = "";

const wholeObject: IWholeObject = {
    free_space: ["LOC1", "LOC2", "LOC3"],
    used_space: []
};

const app = express();

export const emitLocationData = new EventEmitter();

app.get("/health", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "src", "public.html"));
});

app.post("/ppms/:vehicleNumber", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.contentType("application/json");
    if (wholeObject.free_space.length > 0) {
        let data = { location: wholeObject.free_space[0] };
        res.send(JSON.stringify(data));
        console.log(req.params);
        requestedCarNumber = req.params.vehicleNumber;
        console.log(requestedCarNumber);
        assignedLocation = wholeObject.free_space[0];
        wholeObject.free_space.shift();
        console.log(wholeObject);
    } else {
        res.send(JSON.stringify({ no_location: "No Location available" }));
    }
});

const server = app.listen(3000, "0.0.0.0", () => {
    console.log("App is listenng on 3000");
});

startProcess();

const io = socketIo(server);

io.on("connection", socket => {
    socket.on("Disconnect", () => {
        console.log("Client disconnected");
    });

    emitLocationData.on("valueChanged", data => {
        if (data.location === assignedLocation) {
            socket.emit(
                data.location,
                Object.assign({}, data, { requestedCarNumber })
            );
            return;
        }
        socket.emit(
            data.location,
            Object.assign({}, data, { requestedCarNumber: "" })
        );
    });

    socket.on("done", data => {
        console.log("is it done here?");
        requestedCarNumber = "";
        assignedLocation = "";
    });
});

export default server;

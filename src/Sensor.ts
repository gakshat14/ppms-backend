import { Gpio, Direction, Edge, BinaryValue } from "onoff";
import { emitLocationData } from "./server";
import moment from "moment";

export class Sensor {
    constructor(
        pingNumber: number,
        direction: Direction = "in",
        edge: Edge = "both"
    ) {
        new Gpio(pingNumber, direction, edge).watch(this.handleWatch);
    }

    private handleWatch(err: Error, value: BinaryValue) {
        if (value === 1) {
            emitLocationData.emit("valueChanged", {
                location: "LOC1",
                date: moment()
            });
            return;
        }
        emitLocationData.emit("valueChanged", { location: "LOC1", date: null });
    }
}

import { Sensor } from "./Sensor";

const sensors = [
    {
        pin: 27,
        direction: "in",
        edge: "both"
    },
    {
        pin: 17,
        direction: "in",
        edge: "both"
    },
    {
        pin: 22,
        direction: "in",
        edge: "both"
    }
];

export const startProcess = () => {
    sensors.map(sensorData => {
        new Sensor(sensorData.pin);
    });
};

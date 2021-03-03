package main

import (
	b64 "encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)
var tx_topic string = "application/1/device/0000000000000213/tx"
var ack_topic string = "application/1/device/0000000000000213/ack"
var rx_topic string = "application/1/device/0000000000000213/rx"

func encode(data string) string{//downlink
	sEnc := b64.StdEncoding.EncodeToString([]byte(data))
	m := make(map[string]interface{})
	m["confirmed"] = false
	m["fPort"] = 2
	m["data"] = sEnc
	m["timing"]="IMMEDIATELY"
	jsonMsg, err := json.Marshal(m)
	if err != nil{
		panic(err)
	}
	downlink_data := string(jsonMsg)
	return downlink_data
}

func decode(data string) string{ //uplink
	var message map[string]interface{}
	if err := json.Unmarshal([]byte(data),&message); err != nil{
		panic(err)
	}
	mesData := message["data"].(string)
	decoded ,_ := b64.StdEncoding.DecodeString(mesData)
	uplink_data := string(decoded)
	return uplink_data
}

func connect(clientId string, uri *url.URL) mqtt.Client {
	opts := createClientOptions(clientId, uri)
	client := mqtt.NewClient(opts)
	token := client.Connect()
	for !token.WaitTimeout(3 * time.Second) {
	}
	if err := token.Error(); err != nil {
		log.Fatal(err)
	}

	return client
}

func createClientOptions(clientId string, uri *url.URL) *mqtt.ClientOptions {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(fmt.Sprintf("tcp://%s", uri.Host))
	opts.SetUsername(uri.User.Username())
	password, _ := uri.User.Password()
	opts.SetPassword(password)
	opts.SetClientID(clientId)
	return opts
}

func listen(uri *url.URL, topic string) {
	client := connect("sub", uri)
	client.Subscribe(topic, 0, func(client mqtt.Client, msg mqtt.Message) {
		fmt.Printf("* [%s] %s\n", msg.Topic(), string(msg.Payload()))
		uplink_data := decode(string(msg.Payload()))
		fmt.Println("data: "+uplink_data)
		response := "hello world"
		downlink_data := encode(response)
		client.Publish(tx_topic, 0, false,downlink_data)

	})
}

func main() {
	uri, err:= url.Parse("//127.0.0.1:1883")
	if err != nil {
		log.Fatal(err)
		panic(err)
	}

	go listen(uri, rx_topic)

	for {
		time.Sleep(1* time.Second)
	}
}

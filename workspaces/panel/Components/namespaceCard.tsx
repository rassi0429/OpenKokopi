import {Button, Card, Tag, Typography} from "antd";
import React, {useEffect,} from "react";
import {Ingress, Pod} from "@/lib/type";

type NamespaceCardProps = {
  namespace: string;
}


const NamespaceCard = ({ namespace } : NamespaceCardProps) => {

  // podとingressをとってくる
  const [pods, setPods] = React.useState<Pod[]>([]);
  const [ingresses, setIngresses] = React.useState<Ingress[]>([]);

  useEffect(() => {
    fetch(`/api/namespace/${namespace}/pods`)
      .then(res => res.json())
      .then(data => {
        console.log(data)
        setPods(data);
      })

    fetch(`/api/namespace/${namespace}/ingresses`)
      .then(res => res.json())
      .then(data => {
        setIngresses(data);
      })
  }, [namespace]);


  if(pods.length === 0) {
    return <></>
  }

  return (
    <>

    <Card>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 10
      }}>
        <div>
          <Typography.Text>{namespace}</Typography.Text>
        </div>
        {
          ingresses.map((ingress) => (
            <Tag color="green" key={ingress.metadata.name}>
              {ingress.spec.rules[0].host}
            </Tag>
          ))
        }
        <div style={{marginLeft: "auto"}}>
          <Typography.Text>{pods[0].status.phase}</Typography.Text>
        </div>
        <Button color="cyan" variant="solid" href={`/app/${namespace}`}>Details</Button>


      </div>
    </Card>
    </>
  )
}

export default NamespaceCard;

import { Flex, Text } from '@sanity/ui'
import React from 'react'

const IconInfo: React.FC<{
  text: string
  icon: React.FC
  size?: number
  muted?: boolean
}> = (props) => {
  const Icon = props.icon
  return (
    <Flex gap={2} align="center" padding={1}>
      <Text size={props.size || 1} muted={props.muted}>
        <Icon />
      </Text>
      <Text size={props.size || 1} muted={props.muted}>
        {props.text}
      </Text>
    </Flex>
  )
}

export default IconInfo

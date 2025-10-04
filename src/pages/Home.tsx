import { Link as RouterLink } from "react-router-dom";
import { API_BASE } from "../lib/api";
import { Code, Heading, Flex, Button, HStack, Text, Box, Container, Link, Stack } from '@chakra-ui/react';
import { useAuth } from "../state/auth/useAuth";
import UserSummary from "../components/UserSummary";
import HealthCheckCard from "../components/HealthCheckCard";

export default function Home() {

  const { user, bootstrapped } = useAuth();

  return (
    <Container maxW='2xl' py={8}>
      <Stack spacing={8}>
        <Box as='header'>
          <Heading size='xl' mb={2}>🛥️ Welcome to SameBoat 👋</Heading>
          <Text fontSize='sm' opacity={0.8} mb={4}>
            Frontend is running. Backend base URL:&nbsp;
            <Code fontSize='xs'>{API_BASE}</Code>
          </Text>
          <HStack spacing={4} wrap='wrap' fontSize='sm' align='center'>
            {!user && (
              <>
                {!bootstrapped && (
                  <Text opacity={0.6}>Loading session…</Text>
                )}
                {bootstrapped && (
                  <Flex justifyContent={'center'} width={'100%'} >
                    <Stack width={'100%'}>
                      <Text opacity={0.6} fontSize={'xl'} mt={10}>Not signed in.</Text>
                      <Flex justifyContent={'space-around'} width={'100%'}>
                        <Link as={RouterLink} to='/login' textDecoration='underline' fontSize={'lg'}>Login</Link>
                        <Link as={RouterLink} to='/register' textDecoration='underline' fontSize={'lg'}>Register</Link>
                      </Flex>
                    </Stack>
                  </Flex>
                )}
              </>
            )}
            {user && (
              <Flex flexDirection={'column'} m={"auto"} my={6} alignItems={'center'} gap={5}>
                <Text opacity={0.85}>Signed in as <strong>{user.email}</strong></Text>
                <Button size='sm' as={RouterLink} to='/me' variant='outline' colorScheme='blue'>My Account</Button>
              </Flex>
            )}
          </HStack>
        </Box>

        <HealthCheckCard />

      {user && <UserSummary />}
      </Stack>
    </Container>
  );
}